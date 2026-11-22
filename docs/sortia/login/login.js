(() => {
  const login = document.querySelector("[data-sortia-login]");
  if (!login) return;
  const heading = login.querySelector("#access-title");
  const form = login.querySelector(".form");
  const password = login.querySelector("#password");
  const toggle = login.querySelector(".password__toggle");
  const submit = login.querySelector(".primary");
  const hint = login.querySelector(".switch__hint");
  const switchAction = login.querySelector(".switch__action");
  const status = login.querySelector(".status");
  let creating = false;

  function showPassword(visible) {
    password.type = visible ? "text" : "password";
    toggle.textContent = visible ? "Hide" : "Show";
    toggle.setAttribute("aria-label", visible ? "Hide password" : "Show password");
  }

  function changeMode() {
    creating = !creating;
    login.dataset.authMode = creating ? "register" : "login";
    const title = creating ? "Create account" : "Log in";
    heading.textContent = title;
    submit.textContent = title;
    hint.textContent = creating ? "Already have an account?" : "New to Sortia?";
    switchAction.textContent = creating ? "Log in" : "Create account";
    password.autocomplete = creating ? "new-password" : "current-password";
    password.value = "";
    showPassword(false);
    status.textContent = "";
    document.title = "SORTIA · " + title;
    heading.focus({preventScroll:true});
  }

  switchAction.addEventListener("click", changeMode);
  toggle.addEventListener("click", () => showPassword(password.type === "password"));
  // Demo handler. The game wires this form into its existing authentication flow.
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    password.value = "";
    showPassword(false);
    status.textContent = "This preview uses demo mode. Connect SORTIA’s authentication to continue.";
  });
})();
