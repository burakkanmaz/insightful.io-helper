(function () {
  try {
    const activeTokenStr = localStorage.getItem("activeToken");
    const refreshTokenStr = localStorage.getItem("refreshToken");

    if (activeTokenStr && refreshTokenStr) {
      let activeTokenObj = null;
      try {
        activeTokenObj = JSON.parse(activeTokenStr);
      } catch (e) {
        // If parsing fails, do not proceed
        return;
      }
      chrome.runtime.sendMessage({
        action: "saveToken",
        tokensToSave: {
          activeTokenObjectToStore: activeTokenObj,
          refreshTokenToStore: refreshTokenStr,
        },
      });
    }
  } catch (e) {
    // Silently ignore errors or add robust error handling if required later
  }
})();
