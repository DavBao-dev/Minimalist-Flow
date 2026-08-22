import hmac
import re
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

import db

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
        if st.button("Đăng xuất", use_container_width=True):
            st.session_state["authenticated"] = False
            st.session_state.pop("username", None)
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
                db.save_user_state(username, state)


if "authenticated" not in st.session_state:
    st.session_state["authenticated"] = False

if not st.session_state["authenticated"]:
    login_form()
else:
    logout_button()
    render_app()
