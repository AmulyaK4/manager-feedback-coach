"""Streamlit Community Cloud entrypoint; the original local app stays separate."""
import os
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

from streamlit_backend import ProviderLimiter, SessionDispatcher

ROOT = Path(__file__).resolve().parent


@st.cache_resource
def provider_limiter():
    """Share one budget across sessions in this server process."""
    return ProviderLimiter(max_calls=60, max_concurrent=2)


def main():
    st.set_page_config(page_title="Manager feedback coach", layout="wide", initial_sidebar_state="collapsed")
    st.caption("Synthetic practice only. This demo shares 60 AI requests per hour across visitors, with two requests at a time. Scripted Demo remains available when the AI service is busy.")
    # Read only the two known server settings; never send st.secrets to a component.
    for name in ("GEMINI_API_KEY", "GEMINI_MODEL"):
        try:
            value = st.secrets.get(name)
        except FileNotFoundError:
            value = None
        if isinstance(value, str) and value:
            os.environ[name] = value
    state = st.session_state
    if "_coach_dispatcher" not in state:
        state["_coach_dispatcher"] = SessionDispatcher(provider_limiter())
    component = components.declare_component("manager_feedback_coach", path=str(ROOT / "static"))
    previous = state.get("_coach_response")
    request = component(response=previous, key="manager_feedback_coach")
    if request is None:
        return
    response = state["_coach_dispatcher"].handle(request)
    if response != previous:
        state["_coach_response"] = response
        st.rerun()


if __name__ == "__main__":
    main()
