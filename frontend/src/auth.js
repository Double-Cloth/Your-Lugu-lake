export function setUserSession(token) {
  localStorage.setItem("user_token", token);
}

export function clearUserSession() {
  localStorage.removeItem("user_token");
}

export function hasUserSession() {
  return Boolean(localStorage.getItem("user_token"));
}
