import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { ensureSession } from "./services/api";
import { hydrateSessionFromCookies } from "./utils/session";
import "./styles/theme.css";

hydrateSessionFromCookies();

function resumeSession() {
  ensureSession().catch(() => {});
}

window.addEventListener("pageshow", (e) => {
  if (e.persisted) resumeSession();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") resumeSession();
});

const app = createApp(App);

app.use(router);
app.mount("#app");
