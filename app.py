import hmac
import re
import time
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

import db

# Frontend debounces state changes ~150ms before sending them back to Python
# (see static/index.html), plus normal websocket round-trip. This grace
# period on logout gives that pending sync a real chance to land in the DB
# before we tear down the component and drop it on the floor.
LOGOUT_SYNC_GRACE_SECONDS = 1.2

st.set_page_config(
    page_title="Minimalist Flow",
    page_icon="🎯",
    layout="wide",
    initial_sidebar_state="collapsed",
)

db.init_db()

USERNAME_RE = re.compile(r"^[a-zA-Z0-9_.-]{3,32}$")


def get_admin_credentials() -> dict:
    try:
        return dict(st.secrets["credentials"])
    except Exception:
        return {"admin": "admin123"}


def username_exists(username: str) -> bool:
    return username in get_admin_credentials() or db.user_exists(username)


def register_user(username: str, password: str) -> tuple[bool, str]:
    if not USERNAME_RE.match(username):
        return False, "Tên đăng nhập chỉ gồm chữ, số, '.', '_', '-' (3-32 ký tự)."
    if len(password) < 6:
        return False, "Mật khẩu cần tối thiểu 6 ký tự."
    if username_exists(username):
        return False, "Tên đăng nhập đã tồn tại."

    db.create_user(username, password)
    return True, "Đăng ký thành công! Bạn có thể đăng nhập ngay."


def check_login(username: str, password: str) -> bool:
    admin_creds = get_admin_credentials()
    if username in admin_creds:
        return hmac.compare_digest(str(admin_creds[username]), password)
    return db.verify_user(username, password)


def login_form():
    st.markdown(
        """
        <style>
        .block-container {max-width: 420px; padding-top: 8vh;}
        </style>
        """,
        unsafe_allow_html=True,
    )
    st.markdown("## 🎯 Minimalist Flow")

    tab_login, tab_register = st.tabs(["Đăng nhập", "Đăng ký"])

    with tab_login:
        with st.form("login_form", clear_on_submit=False):
            username = st.text_input("Tên đăng nhập", key="login_username")
            password = st.text_input("Mật khẩu", type="password", key="login_password")
            submitted = st.form_submit_button("Đăng nhập", use_container_width=True)

        if submitted:
            username = username.strip()
            if check_login(username, password):
                st.session_state["authenticated"] = True
                st.session_state["username"] = username
                st.rerun()
            else:
                st.error("Sai tên đăng nhập hoặc mật khẩu.")

    with tab_register:
        with st.form("register_form", clear_on_submit=False):
            new_username = st.text_input("Tên đăng nhập mới", key="reg_username")
            new_password = st.text_input("Mật khẩu", type="password", key="reg_password")
            confirm_password = st.text_input("Nhập lại mật khẩu", type="password", key="reg_confirm")
            reg_submitted = st.form_submit_button("Đăng ký", use_container_width=True)

        if reg_submitted:
            if new_password != confirm_password:
                st.error("Mật khẩu nhập lại không khớp.")
            else:
                ok, msg = register_user(new_username.strip(), new_password)
                if ok:
                    st.success(msg)
                else:
                    st.error(msg)


def logout_button():
    with st.sidebar:
        st.write(f"👤 Đăng nhập: **{st.session_state.get('username', '')}**")
        if db.using_turso():
            st.caption("☁️ Progress: Turso")
        else:
            st.caption("💾 Progress: SQLite")

        last_saved = st.session_state.get("last_saved_at")
        if last_saved:
            st.caption(f"✅ Đã lưu lúc {last_saved}")

        if st.session_state.get("logging_out"):
            st.caption("⏳ Đang chờ đồng bộ dữ liệu trước khi đăng xuất…")
            st.button("Đăng xuất", use_container_width=True, disabled=True)
        elif st.button("Đăng xuất", use_container_width=True):
            # Don't flip `authenticated` off immediately: the frontend may
            # still have a debounced state change (e.g. a task you just
            # deleted) in flight that hasn't reached db.save_user_state()
            # yet. Keep the component mounted for one more pass so that
            # pending sync can land, THEN actually log out.
            st.session_state["logging_out"] = True
            st.rerun()


# A V1 bidirectional component lets the already-built React app remain intact
# while sending its complete state back to Python. No npm build is required.
COMPONENT_DIR = Path(__file__).parent / "static"
minimalist_flow = components.declare_component("minimalist_flow", path=str(COMPONENT_DIR))


def render_app():
    username = st.session_state["username"]
    persisted = db.load_user_state(username)

    # A None state means first login. The frontend then starts from its own
    # bundled demo/default state and immediately persists it to this user.
    value = minimalist_flow(
        username=username,
        initial_state=persisted,
        key=f"minimalist-flow-{username}",
        default=None,
    )

    if isinstance(value, dict) and value.get("type") == "state":
        returned_user = value.get("username")
        state = value.get("state")
        if returned_user == username and isinstance(state, dict):
            # Avoid unnecessary writes/reruns when the component sends the same
            # snapshot again after a Streamlit rerun.
            if state != persisted:
                try:
                    db.save_user_state(username, state)
                    st.session_state["last_saved_at"] = time.strftime("%H:%M:%S")
                except Exception as exc:  # noqa: BLE001 - surface, don't hide
                    st.toast(f"⚠️ Không lưu được tiến trình: {exc}", icon="⚠️")


if "authenticated" not in st.session_state:
    st.session_state["authenticated"] = False

if not st.session_state["authenticated"]:
    login_form()
else:
    logout_button()
    # Always render (and thus capture/save) any pending component value
    # first, whether or not we're mid-logout.
    render_app()

    if st.session_state.get("logging_out"):
        # Give the frontend's debounced sync + websocket round-trip a real
        # window to land. If a fresh component value arrives from the
        # browser during this sleep, Streamlit will interrupt this run and
        # start a new one — which re-enters this same `if logging_out`
        # branch, calls render_app() again first (saving that fresh value),
        # and only then waits out another grace period. So logout only
        # actually completes once things have gone quiet.
        time.sleep(LOGOUT_SYNC_GRACE_SECONDS)
        st.session_state["authenticated"] = False
        st.session_state.pop("username", None)
        st.session_state.pop("logging_out", None)
        st.session_state.pop("last_saved_at", None)
        st.rerun()
