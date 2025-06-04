(function() {
  try {
    const token = localStorage.getItem('activeToken');
    if (token) {
      chrome.runtime.sendMessage({ action: 'saveToken', token });
    }
  } catch (e) {
    // Silently ignore errors or add robust error handling if required later
  }
})(); 