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

  // Helper function to parse time string to hours
  function parseTimeToHours(timeStr) {
    if (!timeStr || timeStr === '-') return 0;
    
    // Handle different time formats: "1:20", "8:06", "25:15", "49:25", "176:02"
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      if (parts.length === 2) {
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        return hours + (minutes / 60);
      }
    }
    
    // Parse formats like "8h 30m", "5h", "45m", "2h 15m"
    const hourMatch = timeStr.match(/(\d+)h/);
    const minuteMatch = timeStr.match(/(\d+)m/);
    
    const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
    const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
    
    return hours + (minutes / 60);
  }

  // Helper function to calculate working days in a month (excluding weekends)
  function getWorkingDaysInMonth(year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let workingDays = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      // Monday = 1, Tuesday = 2, ..., Friday = 5 (exclude Saturday = 6, Sunday = 0)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDays++;
      }
    }
    
    return workingDays;
  }

  // Helper function to calculate total hours based on period type
  function calculateTotalHours(period) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    switch (period) {
      case 'today':
      case 'yesterday':
        return 8; // 1 day = 8 hours
      case 'week':
      case 'lastWeek':
        return 40; // 5 days = 40 hours
      case 'month':
        // This month's working days
        return getWorkingDaysInMonth(currentYear, currentMonth) * 8;
      case 'lastMonth':
        // Last month's working days
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        return getWorkingDaysInMonth(lastMonthYear, lastMonth) * 8;
      default:
        return 8;
    }
  }

  // Helper function to calculate progress percentage
  function calculateProgress(workTime, totalHours) {
    const workedHours = parseTimeToHours(workTime);
    if (totalHours === 0) return 0;
    return Math.round((workedHours / totalHours) * 100);
  }

  // Helper function to create progress bar HTML
  function createProgressBar(percentage) {
    return `
      <div>${percentage}%</div>
      <div class="progress-container">
        <div class="progress-bar" style="width: ${Math.min(percentage, 100)}%"></div>
      </div>
    `;
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

      // Set work and idle times
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

      // Calculate and set total hours
      const todayTotal = calculateTotalHours('today');
      const yesterdayTotal = calculateTotalHours('yesterday');
      const weekTotal = calculateTotalHours('week');
      const lastWeekTotal = calculateTotalHours('lastWeek');
      const monthTotal = calculateTotalHours('month');
      const lastMonthTotal = calculateTotalHours('lastMonth');

      document.getElementById('todayTotal').textContent = `${todayTotal}h`;
      document.getElementById('yesterdayTotal').textContent = `${yesterdayTotal}h`;
      document.getElementById('weekTotal').textContent = `${weekTotal}h`;
      document.getElementById('lastWeekTotal').textContent = `${lastWeekTotal}h`;
      document.getElementById('monthTotal').textContent = `${monthTotal}h`;
      document.getElementById('lastMonthTotal').textContent = `${lastMonthTotal}h`;

      // Calculate and set progress percentages with visual bars
      const todayProgress = calculateProgress(data.today?.work, todayTotal);
      const yesterdayProgress = calculateProgress(data.yesterday?.work, yesterdayTotal);
      const weekProgress = calculateProgress(data.thisWeek?.work, weekTotal);
      const lastWeekProgress = calculateProgress(data.lastWeek?.work, lastWeekTotal);
      const monthProgress = calculateProgress(data.thisMonth?.work, monthTotal);
      const lastMonthProgress = calculateProgress(data.lastMonth?.work, lastMonthTotal);

      document.getElementById('todayProgress').innerHTML = createProgressBar(todayProgress);
      document.getElementById('yesterdayProgress').innerHTML = createProgressBar(yesterdayProgress);
      document.getElementById('weekProgress').innerHTML = createProgressBar(weekProgress);
      document.getElementById('lastWeekProgress').innerHTML = createProgressBar(lastWeekProgress);
      document.getElementById('monthProgress').innerHTML = createProgressBar(monthProgress);
      document.getElementById('lastMonthProgress').innerHTML = createProgressBar(lastMonthProgress);

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