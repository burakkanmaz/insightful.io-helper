// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const loadingDiv = document.getElementById('loading');
  const statsContainer = document.getElementById('statsContainer');
  const errorMessageDiv = document.getElementById('errorMessage');
  const moneyToggle = document.getElementById('moneyToggle');
  const optionsButton = document.getElementById('optionsButton');
  const optionsOverlay = document.getElementById('optionsOverlay');
  const hourlyRateInput = document.getElementById('hourlyRateInput');
  const saveOptions = document.getElementById('saveOptions');
  const cancelOptions = document.getElementById('cancelOptions');
  
  let isMoneyMode = false;
  let hourlyRate = null; // No default value

  // Configuration
  const DAILY_TARGET = 8; // 8 hours per day
  const WEEKLY_TARGET = 40; // 40 hours per week

  // Helper function to parse time string to hours
  function parseTimeToHours(timeStr) {
    if (!timeStr || timeStr === '-') return 0;
    
    if (timeStr.includes(':')) {
      const parts = timeStr.split(':');
      if (parts.length === 2) {
        const hours = parseInt(parts[0]) || 0;
        const minutes = parseInt(parts[1]) || 0;
        return hours + (minutes / 60);
      }
    }
    
    const hourMatch = timeStr.match(/(\d+)h/);
    const minuteMatch = timeStr.match(/(\d+)m/);
    
    const hours = hourMatch ? parseInt(hourMatch[1]) : 0;
    const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
    
    return hours + (minutes / 60);
  }

  // Helper function to format hours to readable format
  function formatHours(hours) {
    if (hours === 0) return '00:00';
    if (hours < 0) return `-${formatHours(Math.abs(hours))}`;
    
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  // Helper function to format money
  function formatMoney(hours) {
    if (!hourlyRate) {
      return 'Set Rate First';
    }
    const amount = hours * hourlyRate;
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  // Get working days in a month
  function getWorkingDaysInMonth(year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let workingDays = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDays++;
      }
    }
    
    return workingDays;
  }

  // Get working days passed this month (including today)
  function getWorkingDaysPassedThisMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    
    let workingDaysPassed = 0;
    
    for (let day = 1; day <= today; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDaysPassed++;
      }
    }
    
    return workingDaysPassed;
  }

  // Get remaining working days this month
  function getRemainingWorkingDaysThisMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let remainingWorkingDays = 0;
    
    for (let day = today + 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        remainingWorkingDays++;
      }
    }
    
    return remainingWorkingDays;
  }

  // Get remaining working days this week
  function getRemainingWorkingDaysThisWeek() {
    const now = new Date();
    const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    
    if (currentDay === 0 || currentDay === 6) return 0; // Weekend
    
    return Math.max(0, 5 - currentDay); // Remaining days including today
  }


  // Get remaining hours today
  function getRemainingHoursToday() {
    return DAILY_TARGET; // Always 8 hours available for today
  }

  // Calculate days passed this week
  function getDaysPassedThisWeek() {
    const now = new Date();
    const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    
    if (currentDay === 0) return 0; // Sunday
    if (currentDay === 6) return 5; // Saturday
    
    return currentDay; // Monday=1, Tuesday=2, ..., Friday=5
  }


  // Update progress bar
  function updateProgressBar(elementId, percentage, status, hours = 0) {
    const progressBar = document.getElementById(elementId);
    const progressText = document.getElementById(elementId.replace('Bar', 'Text'));
    
    if (progressBar && progressText) {
      progressBar.style.display = 'block';
      progressBar.style.width = `${Math.min(percentage, 100)}%`;
      progressBar.className = 'progress-bar';
      
      // Set color based on percentage
      if (percentage >= 90) {
        progressBar.classList.add('excellent');
      } else if (percentage >= 70) {
        progressBar.classList.add('good');
      } else if (percentage >= 50) {
        progressBar.classList.add('warning');
      } else {
        progressBar.classList.add('danger');
      }
      
      progressText.textContent = `${Math.round(percentage)}%`;
      progressText.className = 'progress-text';
    }
  }

  // Update money value
  function updateMoneyValue(elementId, hours) {
    const moneyElement = document.getElementById(elementId);
    if (moneyElement) {
      moneyElement.textContent = formatMoney(hours);
      moneyElement.className = 'stat-value';
    }
  }

  // Toggle money mode
  function toggleMoneyMode() {
    // Check if hourly rate is set
    if (!hourlyRate) {
      alert('Please set your hourly rate first by clicking the options button (⚒️)');
      return;
    }
    
    isMoneyMode = !isMoneyMode;
    moneyToggle.classList.toggle('active', isMoneyMode);
    
    // Update all money values
    updateAllMoneyValues();
  }

  // Update all money values
  function updateAllMoneyValues() {
    const moneyColumns = document.querySelectorAll('.money-column');
    const moneyHeaders = document.querySelectorAll('.stats-header .header-item:last-child');
    
    moneyColumns.forEach(column => {
      if (isMoneyMode) {
        column.style.display = 'flex';
      } else {
        column.style.display = 'none';
      }
    });
    
    moneyHeaders.forEach(header => {
      if (isMoneyMode) {
        header.style.display = 'block';
      } else {
        header.style.display = 'none';
      }
    });
  }
  
  // Options popup functions
  function openOptionsPopup() {
    optionsOverlay.classList.remove('hidden');
    hourlyRateInput.value = hourlyRate;
  }
  
  function closeOptionsPopup() {
    optionsOverlay.classList.add('hidden');
  }
  
  function saveHourlyRate() {
    const rate = parseFloat(hourlyRateInput.value);
    if (isNaN(rate) || rate <= 0) {
      alert('Please enter a valid hourly rate greater than 0');
      return;
    }
    
    hourlyRate = rate;
    localStorage.setItem('hourlyRate', rate.toString());
    closeOptionsPopup();
    
    // Update all money values with new rate
    updateAllMoneyValuesWithNewRate();
  }
  
  function loadHourlyRate() {
    const savedRate = localStorage.getItem('hourlyRate');
    if (savedRate) {
      hourlyRate = parseFloat(savedRate);
    }
  }
  
  // Update all money values with new rate
  function updateAllMoneyValuesWithNewRate() {
    // Get current worked hours from the displayed values
    const todayWork = document.getElementById('todayWork').textContent;
    const yesterdayWork = document.getElementById('yesterdayWork').textContent;
    const weekWork = document.getElementById('weekWork').textContent;
    const lastWeekWork = document.getElementById('lastWeekWork').textContent;
    const monthWork = document.getElementById('monthWork').textContent;
    const lastMonthWork = document.getElementById('lastMonthWork').textContent;
    
    // Convert to hours and update money values
    if (todayWork && todayWork !== '-') {
      updateMoneyValue('todayMoney', parseTimeToHours(todayWork));
    }
    if (yesterdayWork && yesterdayWork !== '-') {
      updateMoneyValue('yesterdayMoney', parseTimeToHours(yesterdayWork));
    }
    if (weekWork && weekWork !== '-') {
      updateMoneyValue('weekMoney', parseTimeToHours(weekWork));
    }
    if (lastWeekWork && lastWeekWork !== '-') {
      updateMoneyValue('lastWeekMoney', parseTimeToHours(lastWeekWork));
    }
    if (monthWork && monthWork !== '-') {
      updateMoneyValue('monthMoney', parseTimeToHours(monthWork));
    }
    if (lastMonthWork && lastMonthWork !== '-') {
      updateMoneyValue('lastMonthMoney', parseTimeToHours(lastMonthWork));
    }
  }


  // Calculate daily metrics
  function calculateDailyMetrics(todayWork, yesterdayWork) {
    const todayWorked = parseTimeToHours(todayWork);
    const yesterdayWorked = parseTimeToHours(yesterdayWork);
    const remainingHoursToday = getRemainingHoursToday();
    
    // Calculate actual remaining hours to reach target
    const todayRemaining = Math.max(0, DAILY_TARGET - todayWorked);
    
    // Today calculations
    const todayPotential = todayWorked + remainingHoursToday;
    const todayProgress = (todayWorked / DAILY_TARGET) * 100;
    const todayGap = todayWorked - DAILY_TARGET;
    
    let todayStatus = 'on-track';
    let todayStatusText = 'On Track';
    
    if (todayWorked >= DAILY_TARGET) {
      todayStatus = 'ahead';
      todayStatusText = 'Complete';
    } else if (todayPotential >= DAILY_TARGET) {
      todayStatus = 'on-track';
      todayStatusText = 'On Track';
    } else if (todayPotential >= DAILY_TARGET * 0.8) {
      todayStatus = 'behind';
      todayStatusText = 'Behind';
    } else {
      todayStatus = 'critical';
      todayStatusText = 'Critical';
    }
    
    // Yesterday calculations
    const yesterdayProgress = (yesterdayWorked / DAILY_TARGET) * 100;
    let yesterdayStatus = 'on-track';
    let yesterdayStatusText = 'Good';
    
    if (yesterdayWorked >= DAILY_TARGET) {
      yesterdayStatus = 'ahead';
      yesterdayStatusText = 'Complete';
    } else if (yesterdayWorked >= DAILY_TARGET * 0.8) {
      yesterdayStatus = 'behind';
      yesterdayStatusText = 'Behind';
    } else {
      yesterdayStatus = 'critical';
      yesterdayStatusText = 'Low';
    }
    
    return {
      today: {
        worked: todayWorked,
        remaining: todayRemaining,
        progress: todayProgress,
        status: todayStatus,
        statusText: todayStatusText,
        gap: todayGap
      },
      yesterday: {
        worked: yesterdayWorked,
        remaining: Math.max(0, DAILY_TARGET - yesterdayWorked),
        progress: yesterdayProgress,
        status: yesterdayStatus,
        statusText: yesterdayStatusText
      }
    };
  }

  // Calculate weekly metrics
  function calculateWeeklyMetrics(weekWork) {
    const weekWorked = parseTimeToHours(weekWork);
    const daysPassedThisWeek = getDaysPassedThisWeek();
    const remainingDays = getRemainingWorkingDaysThisWeek();
    const remainingHoursToday = getRemainingHoursToday();
    
    // Calculate actual remaining hours to reach target
    const weeklyRemaining = Math.max(0, WEEKLY_TARGET - weekWorked);
    const weekProgress = (weekWorked / WEEKLY_TARGET) * 100;
    
    // Calculate remaining potential (what we CAN still work)
    const remainingPotential = (remainingDays - 1) * DAILY_TARGET + remainingHoursToday;
    const weekPotential = weekWorked + remainingPotential;
    
    // Status calculation
    let weekStatus = 'on-track';
    let weekStatusText = 'On Track';
    
    if (weekWorked >= WEEKLY_TARGET) {
      weekStatus = 'ahead';
      weekStatusText = 'Complete';
    } else if (weekPotential >= WEEKLY_TARGET) {
      weekStatus = 'on-track';
      weekStatusText = 'On Track';
    } else if (weekPotential >= WEEKLY_TARGET * 0.9) {
      weekStatus = 'behind';
      weekStatusText = 'Behind';
    } else {
      weekStatus = 'critical';
      weekStatusText = 'Critical';
    }
    
    return {
      worked: weekWorked,
      remaining: weeklyRemaining,
      progress: weekProgress,
      status: weekStatus,
      statusText: weekStatusText
    };
  }

  // Calculate monthly metrics
  function calculateMonthlyMetrics(monthWork) {
    const monthWorked = parseTimeToHours(monthWork);
    const now = new Date();
    const monthTarget = getWorkingDaysInMonth(now.getFullYear(), now.getMonth()) * DAILY_TARGET;
    const daysPassedThisMonth = getWorkingDaysPassedThisMonth();
    const remainingDays = getRemainingWorkingDaysThisMonth();
    const remainingHoursToday = getRemainingHoursToday();
    
    // Calculate actual remaining hours to reach target
    const monthlyRemaining = Math.max(0, monthTarget - monthWorked);
    const monthProgress = (monthWorked / monthTarget) * 100;
    
    // Calculate remaining potential (what we CAN still work)
    const remainingPotential = (remainingDays - 1) * DAILY_TARGET + remainingHoursToday;
    const monthPotential = monthWorked + remainingPotential;
    
    // Calculate capacity gap (remaining to target - remaining capacity)
    const remainingCapacity = remainingDays * DAILY_TARGET;
    const capacityGap = monthlyRemaining - remainingCapacity;
    
    // Status calculation
    let monthStatus = 'on-track';
    let monthStatusText = 'On Track';
    
    if (monthWorked >= monthTarget) {
      monthStatus = 'ahead';
      monthStatusText = 'Complete';
    } else if (monthPotential >= monthTarget) {
      monthStatus = 'on-track';
      monthStatusText = 'On Track';
    } else if (monthPotential >= monthTarget * 0.9) {
      monthStatus = 'behind';
      monthStatusText = 'Behind';
    } else {
      monthStatus = 'critical';
      monthStatusText = 'Critical';
    }
    
    return {
      worked: monthWorked,
      remaining: monthlyRemaining,
      progress: monthProgress,
      status: monthStatus,
      statusText: monthStatusText,
      target: monthTarget
    };
  }

  // Calculate workdays analysis
  function calculateWorkdaysAnalysis(monthWork) {
    const monthWorked = parseTimeToHours(monthWork);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    // Get workdays data
    const workdaysPassed = getWorkingDaysPassedThisMonth();
    const workdaysRemaining = getRemainingWorkingDaysThisMonth();
    const workdaysTotal = getWorkingDaysInMonth(year, month);
    
    // Calculate expected vs actual
    const expectedHours = workdaysPassed * DAILY_TARGET;
    const actualHours = monthWorked;
    const difference = actualHours - expectedHours;
    
    // Format status
    let statusText = '';
    if (difference > 0) {
      statusText = `Ahead ${formatHours(difference)}`;
    } else if (difference < 0) {
      statusText = `Behind ${formatHours(Math.abs(difference))}`;
    } else {
      statusText = 'On Track';
    }
    
    return {
      today: workdaysPassed,
      remaining: workdaysRemaining,
      total: workdaysTotal,
      status: statusText
    };
  }

  // Initialize money toggle and options
  if (moneyToggle) {
    moneyToggle.addEventListener('click', toggleMoneyMode);
  }
  
  if (optionsButton) {
    optionsButton.addEventListener('click', openOptionsPopup);
  }
  
  if (saveOptions) {
    saveOptions.addEventListener('click', saveHourlyRate);
  }
  
  if (cancelOptions) {
    cancelOptions.addEventListener('click', closeOptionsPopup);
  }
  
  if (optionsOverlay) {
    optionsOverlay.addEventListener('click', (e) => {
      if (e.target === optionsOverlay) {
        closeOptionsPopup();
      }
    });
  }
  
  // Load saved hourly rate
  loadHourlyRate();

  // Initially show loading, hide stats and error
  loadingDiv.classList.remove('hidden');
  statsContainer.classList.add('hidden');
  errorMessageDiv.classList.add('hidden');

  // Request data from background script
  chrome.runtime.sendMessage({ action: 'getAggregatedTimes' }, (response) => {
    loadingDiv.classList.add('hidden');

    // Handle errors
    if (chrome.runtime.lastError) {
      errorMessageDiv.textContent = 'Runtime Error: ' + chrome.runtime.lastError.message;
      errorMessageDiv.classList.remove('hidden');
      statsContainer.classList.add('hidden');
      return;
    }

    if (response && response.error && 
        (response.error.toLowerCase().includes('token not found') || 
         response.error.toLowerCase().includes('unauthorized'))) {
      errorMessageDiv.innerHTML = `Please log in to <a href="https://app.insightful.io/" target="_blank" style="color: #5e35b1;">Insightful.io</a> first, then try again.`;
      errorMessageDiv.classList.remove('hidden');
      statsContainer.classList.add('hidden');
      return;
    }

    if (response && response.error) {
      errorMessageDiv.textContent = 'Error: ' + response.error;
      errorMessageDiv.classList.remove('hidden');
      if (!response.data || Object.keys(response.data).length <= 2) { 
            statsContainer.classList.add('hidden');
      }
    }

    // Process and display data
    if (response && response.data) {
      const data = response.data;

      if (data.userProfileError && (!response.error || response.error === data.userProfileError)) {
        let currentErrorText = errorMessageDiv.textContent;
        let profileErrorMsg = 'User Profile: ' + data.userProfileError;
        errorMessageDiv.textContent = currentErrorText && !currentErrorText.includes(profileErrorMsg) ? `${currentErrorText} | ${profileErrorMsg}` : profileErrorMsg;
        if (profileErrorMsg && profileErrorMsg.trim() !== 'User Profile:') errorMessageDiv.classList.remove('hidden');
      }

      // Calculate all metrics
      const dailyMetrics = calculateDailyMetrics(data.today?.work, data.yesterday?.work);
      const weeklyMetrics = calculateWeeklyMetrics(data.thisWeek?.work);
      const lastWeekMetrics = calculateWeeklyMetrics(data.lastWeek?.work);
      const monthlyMetrics = calculateMonthlyMetrics(data.thisMonth?.work);
      const lastMonthMetrics = calculateMonthlyMetrics(data.lastMonth?.work);
      const workdaysAnalysis = calculateWorkdaysAnalysis(data.thisMonth?.work);

      // Update Daily section
      document.getElementById('todayWork').textContent = formatHours(dailyMetrics.today.worked);
      document.getElementById('todayIdle').textContent = formatHours(parseTimeToHours(data.today?.idle || '-'));
      document.getElementById('todayRemaining').textContent = formatHours(dailyMetrics.today.remaining);
      document.getElementById('yesterdayWork').textContent = formatHours(dailyMetrics.yesterday.worked);
      document.getElementById('yesterdayIdle').textContent = formatHours(parseTimeToHours(data.yesterday?.idle || '-'));
      document.getElementById('yesterdayRemaining').textContent = formatHours(dailyMetrics.yesterday.remaining);
      
      updateProgressBar('todayProgressBar', dailyMetrics.today.progress, dailyMetrics.today.status, dailyMetrics.today.worked);
      updateProgressBar('yesterdayProgressBar', dailyMetrics.yesterday.progress, dailyMetrics.yesterday.status, dailyMetrics.yesterday.worked);
      
      // Update money values
      updateMoneyValue('todayMoney', dailyMetrics.today.worked);
      updateMoneyValue('yesterdayMoney', dailyMetrics.yesterday.worked);
      
      // Update money values
      updateMoneyValue('todayMoney', dailyMetrics.today.worked);
      updateMoneyValue('yesterdayMoney', dailyMetrics.yesterday.worked);

      // Update Weekly section
      document.getElementById('weekWork').textContent = formatHours(weeklyMetrics.worked);
      document.getElementById('weekIdle').textContent = formatHours(parseTimeToHours(data.thisWeek?.idle || '-'));
      document.getElementById('weekRemaining').textContent = formatHours(weeklyMetrics.remaining);
      
      document.getElementById('lastWeekWork').textContent = formatHours(lastWeekMetrics.worked);
      document.getElementById('lastWeekIdle').textContent = formatHours(parseTimeToHours(data.lastWeek?.idle || '-'));
      document.getElementById('lastWeekRemaining').textContent = formatHours(lastWeekMetrics.remaining);
      
      updateProgressBar('weekProgressBar', weeklyMetrics.progress, weeklyMetrics.status, weeklyMetrics.worked);
      updateProgressBar('lastWeekProgressBar', lastWeekMetrics.progress, lastWeekMetrics.status, lastWeekMetrics.worked);
      
      // Update money values
      updateMoneyValue('weekMoney', weeklyMetrics.worked);
      updateMoneyValue('lastWeekMoney', lastWeekMetrics.worked);
      
      // Update money values
      updateMoneyValue('weekMoney', weeklyMetrics.worked);
      updateMoneyValue('lastWeekMoney', lastWeekMetrics.worked);

      // Update Monthly section
      const now = new Date();
      const monthTarget = getWorkingDaysInMonth(now.getFullYear(), now.getMonth()) * DAILY_TARGET;
      const lastMonthTarget = getWorkingDaysInMonth(now.getFullYear(), now.getMonth() - 1) * DAILY_TARGET;
      
      document.getElementById('monthWork').textContent = formatHours(monthlyMetrics.worked);
      document.getElementById('monthIdle').textContent = formatHours(parseTimeToHours(data.thisMonth?.idle || '-'));
      document.getElementById('monthRemaining').textContent = formatHours(monthlyMetrics.remaining);
      document.getElementById('monthTotal').textContent = formatHours(monthTarget);
      
      document.getElementById('lastMonthWork').textContent = formatHours(lastMonthMetrics.worked);
      document.getElementById('lastMonthIdle').textContent = formatHours(parseTimeToHours(data.lastMonth?.idle || '-'));
      document.getElementById('lastMonthRemaining').textContent = formatHours(lastMonthMetrics.remaining);
      document.getElementById('lastMonthTotal').textContent = formatHours(lastMonthTarget);
      
      updateProgressBar('monthProgressBar', monthlyMetrics.progress, monthlyMetrics.status, monthlyMetrics.worked);
      updateProgressBar('lastMonthProgressBar', lastMonthMetrics.progress, lastMonthMetrics.status, lastMonthMetrics.worked);
      
      // Update money values
      updateMoneyValue('monthMoney', monthlyMetrics.worked);
      updateMoneyValue('lastMonthMoney', lastMonthMetrics.worked);
      
      // Update money values
      updateMoneyValue('monthMoney', monthlyMetrics.worked);
      updateMoneyValue('lastMonthMoney', lastMonthMetrics.worked);
      
      // Update Summary
      const statusText = workdaysAnalysis.status;
      const statusElement = document.getElementById('summaryStatus');
      
      // Split status text to make only the word bold, not the time
      if (statusText.includes(' ')) {
        const parts = statusText.split(' ');
        const word = parts[0];
        const time = parts.slice(1).join(' ');
        statusElement.innerHTML = `${word} <span class="time">${time}</span>`;
      } else {
        statusElement.textContent = statusText;
      }
      
      document.getElementById('summaryWorkdays').textContent = `${workdaysAnalysis.today} + ${workdaysAnalysis.remaining} = ${workdaysAnalysis.total}`;

      statsContainer.classList.remove('hidden');
      
      // Update all money values after data is loaded
      updateAllMoneyValues();
    } else if (!response.error) {
      errorMessageDiv.textContent = 'Error: No data received or data is in unexpected format.';
      errorMessageDiv.classList.remove('hidden');
      statsContainer.classList.add('hidden');
    }
  });
});