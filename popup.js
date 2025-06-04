// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const loadingDiv = document.getElementById('loading');
  const utilizationTable = document.getElementById('utilizationTable');
  const errorMessageDiv = document.getElementById('errorMessage');
  const userNameDiv = document.getElementById('userName');
  const lastUpdatedDiv = document.getElementById('lastUpdatedTime');
  const openDashboardLink = document.getElementById('openDashboardLink');

  let lastUpdateTimeGlobal = null;
  let timeAgoInterval = null;

  // Open Dashboard link functionality
  if (openDashboardLink) {
    openDashboardLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://app.insightful.io/#/app/employee/active' });
    });
  }

  function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const now = new Date();
    const seconds = Math.round((now.getTime() - new Date(timestamp).getTime()) / 1000);

    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds} seconds ago`;
    
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    
    const days = Math.round(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  function updateLastUpdatedText() {
    if (lastUpdateTimeGlobal) {
      lastUpdatedDiv.textContent = `Last updated: ${formatTimeAgo(lastUpdateTimeGlobal)}`;
    } else {
      lastUpdatedDiv.textContent = '';
    }
  }

  // Initially show loading, hide table and error
  loadingDiv.classList.remove('hidden');
  utilizationTable.classList.add('hidden');
  errorMessageDiv.classList.add('hidden');
  userNameDiv.textContent = 'Loading user...';
  lastUpdatedDiv.textContent = '';

  // Clear any existing interval when popup is reloaded/reopened
  if (timeAgoInterval) {
    clearInterval(timeAgoInterval);
  }

  // Request aggregated data from background script
  chrome.runtime.sendMessage({ action: 'getAggregatedTimes' }, (response) => {
    loadingDiv.classList.add('hidden'); // Hide loading indicator

    if (response && response.lastUpdated) {
      lastUpdateTimeGlobal = response.lastUpdated;
      updateLastUpdatedText(); // Initial update
      // Start interval only if we have a valid timestamp
      if (lastUpdateTimeGlobal) {
        if (timeAgoInterval) clearInterval(timeAgoInterval); // Clear previous interval if any
        timeAgoInterval = setInterval(updateLastUpdatedText, 1000); // Update every second
      }
    } else {
      lastUpdateTimeGlobal = null; // Ensure it's null if no timestamp from response
      updateLastUpdatedText();
    }

    // Handle general Chrome runtime errors
    if (chrome.runtime.lastError) {
      errorMessageDiv.textContent = 'Runtime Error: ' + chrome.runtime.lastError.message;
      errorMessageDiv.classList.remove('hidden');
      utilizationTable.classList.add('hidden');
      userNameDiv.textContent = '-';
      if (timeAgoInterval) clearInterval(timeAgoInterval); // Stop interval on error
      lastUpdateTimeGlobal = null; updateLastUpdatedText(); // Clear last updated text
      return;
    }

    // Handle specific errors for missing or invalid token (Unauthorized)
    if (response && response.error && 
        (response.error.toLowerCase().includes('token not found') || 
         response.error.toLowerCase().includes('unauthorized'))) {
      errorMessageDiv.innerHTML = `Please log in to <a href="https://app.insightful.io/" target="_blank" style="color: #5e35b1;">Insightful.io</a> first, then try again.`;
      errorMessageDiv.classList.remove('hidden');
      utilizationTable.classList.add('hidden');
      userNameDiv.textContent = '-';
      // Hide dashboard link and last updated if token is invalid
      if(openDashboardLink) openDashboardLink.parentElement.classList.add('hidden');
      lastUpdatedDiv.classList.add('hidden');
      if (timeAgoInterval) clearInterval(timeAgoInterval); // Stop interval on token error
      lastUpdateTimeGlobal = null; updateLastUpdatedText(); // Clear last updated text
      return; // Stop further processing
    }
    
    // Show dashboard link and last updated if previously hidden by token error
    if(openDashboardLink) openDashboardLink.parentElement.classList.remove('hidden');
    lastUpdatedDiv.classList.remove('hidden');

    // Handle other errors reported by background script
    if (response && response.error) {
      errorMessageDiv.textContent = 'Error: ' + response.error;
      errorMessageDiv.classList.remove('hidden');
      // Still attempt to show username if available and error is not token related
      if (response.data && response.data.userName) {
         userNameDiv.textContent = response.data.userName;
      } else {
         userNameDiv.textContent = 'User: Error';
      }
      // Hide table if the error seems critical for data display
      if (!response.data || Object.keys(response.data).length <= 2) { 
            utilizationTable.classList.add('hidden');
      }
      // Note: Interval for timeAgo continues if other data is present but some minor error occurred.
      // If this is not desired, add clearInterval(timeAgoInterval) here too.
    }

    // Process and display data if available
    if (response && response.data) {
      const data = response.data;
      userNameDiv.textContent = data.userName || '-';

      // If there was a user profile error specifically, but not a global critical error (like token missing)
      if (data.userProfileError && (!response.error || response.error === data.userProfileError)) {
        // Prepend profile error to existing messages if any, or set it.
        let currentErrorText = errorMessageDiv.textContent;
        let profileErrorMsg = 'User Profile: ' + data.userProfileError;
        errorMessageDiv.textContent = currentErrorText && !currentErrorText.includes(profileErrorMsg) ? `${currentErrorText} | ${profileErrorMsg}` : profileErrorMsg;
        if (profileErrorMsg && profileErrorMsg.trim() !== 'User Profile:') errorMessageDiv.classList.remove('hidden');
      }

      document.getElementById('todayWork').textContent = data.today?.work || '-';
      document.getElementById('todayIdle').textContent = data.today?.idle || '-';
      document.getElementById('yesterdayWork').textContent = data.yesterday?.work || '-';
      document.getElementById('yesterdayIdle').textContent = data.yesterday?.idle || '-';
      document.getElementById('weekWork').textContent = data.thisWeek?.work || '-';
      document.getElementById('weekIdle').textContent = data.thisWeek?.idle || '-';
      document.getElementById('monthWork').textContent = data.thisMonth?.work || '-';
      document.getElementById('monthIdle').textContent = data.thisMonth?.idle || '-';
      document.getElementById('lastWeekWork').textContent = data.lastWeek?.work || '-';
      document.getElementById('lastWeekIdle').textContent = data.lastWeek?.idle || '-';
      document.getElementById('lastMonthWork').textContent = data.lastMonth?.work || '-';
      document.getElementById('lastMonthIdle').textContent = data.lastMonth?.idle || '-';

      utilizationTable.classList.remove('hidden');
      // errorMessageDiv.classList.add('hidden'); // Keep error visible if it's just a profile error
    } else if (!response.error) { // No data but also no primary error reported, implies something went wrong
      errorMessageDiv.textContent = 'Error: No data received or data is in unexpected format.';
      errorMessageDiv.classList.remove('hidden');
      utilizationTable.classList.add('hidden');
      userNameDiv.textContent = '-';
      if (timeAgoInterval) clearInterval(timeAgoInterval); // Stop interval if no data and no error
      lastUpdateTimeGlobal = null; updateLastUpdatedText(); // Clear last updated text
    }
  });
}); 