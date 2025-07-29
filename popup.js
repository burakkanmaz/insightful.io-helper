// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const loadingDiv = document.getElementById('loading');
  const statsContainer = document.getElementById('statsContainer');
  const errorMessageDiv = document.getElementById('errorMessage');
  const userNameDiv = document.getElementById('userName');
  const lastUpdatedDiv = document.getElementById('lastUpdatedTime');
  const openDashboardLink = document.getElementById('openDashboardLink');

  // Screenshots elements
  const screenshotsLoading = document.getElementById('screenshots-loading');
  const screenshotsContent = document.getElementById('screenshots-content');
  const screenshotsError = document.getElementById('screenshots-error');

  let lastUpdateTimeGlobal = null;
  let timeAgoInterval = null;

  // Configuration
  const DAILY_TARGET = 8; // 8 hours per day
  const WEEKLY_TARGET = 40; // 40 hours per week
  const WORK_START_HOUR = 11; // 11 AM
  const WORK_END_HOUR = 19; // 7 PM

  // Tab functionality
  function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.getAttribute('data-tab');
        
        // Update active button
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Update active content
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(`${targetTab}-tab`).classList.add('active');
        
        // Load screenshots data when screenshots tab is activated
        if (targetTab === 'screenshots') {
          loadScreenshots();
        }
      });
    });
  }

  // Screenshots functionality
  async function loadScreenshots() {
    if (screenshotsContent.classList.contains('hidden')) {
      screenshotsLoading.classList.remove('hidden');
      screenshotsContent.classList.add('hidden');
      screenshotsError.classList.add('hidden');
    }

    try {
      // Use the same timestamp calculation as background script for consistency
      const today = new Date();
      
      // Debug: Log current date
      console.log('Current date:', today.toISOString());
      console.log('Current date parts:', {
        year: today.getFullYear(),
        month: today.getMonth(),
        date: today.getDate(),
        hours: today.getHours(),
        minutes: today.getMinutes()
      });
      
      // Today - use local timezone like the site
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
      const endOfDay = startOfDay + (24 * 60 * 60 * 1000) - 1;
      
      // Debug: Log today's range
      console.log('Today range:', {
        start: new Date(startOfDay).toISOString(),
        end: new Date(endOfDay).toISOString(),
        startLocal: new Date(startOfDay).toLocaleString(),
        endLocal: new Date(endOfDay).toLocaleString()
      });
      
      // This week - Monday to Sunday
      const startOfWeek = new Date(today);
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0, Monday = 1
      startOfWeek.setDate(today.getDate() + diffToMonday);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      
      // Debug: Log week's range
      console.log('Week range:', {
        start: startOfWeek.toISOString(),
        end: endOfWeek.toISOString(),
        startLocal: startOfWeek.toLocaleString(),
        endLocal: endOfWeek.toLocaleString()
      });
      
      // This month
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getTime();
      
      // Debug: Log month's range
      console.log('Month range:', {
        start: new Date(startOfMonth).toISOString(),
        end: new Date(endOfMonth).toISOString(),
        startLocal: new Date(startOfMonth).toLocaleString(),
        endLocal: new Date(endOfMonth).toLocaleString()
      });

      const [todayScreenshots, weekScreenshots, monthScreenshots] = await Promise.all([
        fetchScreenshots(startOfDay, endOfDay),
        fetchScreenshots(startOfWeek.getTime(), endOfWeek.getTime()),
        fetchScreenshots(startOfMonth, endOfMonth)
      ]);

      // Debug: Log screenshot counts
      console.log('Screenshot counts:', {
        today: todayScreenshots.length,
        week: weekScreenshots.length,
        month: monthScreenshots.length
      });

      displayScreenshots('today-screenshots-list', todayScreenshots);
      displayScreenshots('week-screenshots-list', weekScreenshots);
      displayScreenshots('month-screenshots-list', monthScreenshots);

      // Update section headers with total counts
      updateSectionHeader('today-screenshots', todayScreenshots.length);
      updateSectionHeader('week-screenshots', weekScreenshots.length);
      updateSectionHeader('month-screenshots', monthScreenshots.length);

      screenshotsLoading.classList.add('hidden');
      screenshotsContent.classList.remove('hidden');
    } catch (error) {
      console.error('Error loading screenshots:', error);
      screenshotsError.textContent = `Error loading screenshots: ${error.message}`;
      screenshotsError.classList.remove('hidden');
      screenshotsLoading.classList.add('hidden');
    }
  }

  async function fetchScreenshots(start, end) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 30000); // 30 second timeout
      
      console.log('Fetching screenshots with range:', {
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        startTimestamp: start,
        endTimestamp: end
      });
      
      chrome.runtime.sendMessage(
        { 
          action: 'getScreenshots', 
          start: start, 
          end: end 
        }, 
        (response) => {
          clearTimeout(timeout);
          
          if (chrome.runtime.lastError) {
            console.error('Runtime error:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (response && response.error) {
            console.error('API error:', response.error);
            reject(new Error(response.error));
            return;
          }
          
          console.log('API response received:', {
            dataLength: response.data ? response.data.length : 0,
            firstScreenshot: response.data && response.data.length > 0 ? {
              timestamp: response.data[0].timestamp,
              date: new Date(response.data[0].timestamp).toISOString(),
              localDate: new Date(response.data[0].timestamp).toLocaleString(),
              app: response.data[0].app,
              title: response.data[0].title
            } : null
          });
          
          resolve(response.data || []);
        }
      );
    });
  }

  function displayScreenshots(containerId, screenshots) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    if (!screenshots || screenshots.length === 0) {
      container.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No screenshots found</div>';
      return;
    }

    // Debug: Log first few screenshots to check timestamps
    console.log('First 3 screenshots:', screenshots.slice(0, 3).map(s => ({
      app: s.app,
      title: s.title,
      timestamp: s.timestamp,
      date: new Date(s.timestamp).toISOString(),
      localDate: new Date(s.timestamp).toLocaleString()
    })));

    // Group screenshots by app
    const groupedScreenshots = {};
    screenshots.forEach(screenshot => {
      const app = screenshot.app || 'Unknown App';
      const title = screenshot.title || 'Unknown';
      
      if (!groupedScreenshots[app]) {
        groupedScreenshots[app] = {
          count: 0,
          lastDate: 0,
          sites: {}
        };
      }
      
      // Group by title (site) within each app
      if (!groupedScreenshots[app].sites[title]) {
        groupedScreenshots[app].sites[title] = {
          count: 0,
          lastDate: 0,
          screenshots: []
        };
      }
      
      groupedScreenshots[app].sites[title].screenshots.push(screenshot);
      groupedScreenshots[app].sites[title].count++;
      groupedScreenshots[app].sites[title].lastDate = Math.max(
        groupedScreenshots[app].sites[title].lastDate, 
        screenshot.timestamp
      );
      
      groupedScreenshots[app].count++;
      groupedScreenshots[app].lastDate = Math.max(
        groupedScreenshots[app].lastDate, 
        screenshot.timestamp
      );
    });

    // Sort apps by count (descending) and then by last date (descending)
    const sortedApps = Object.entries(groupedScreenshots)
      .map(([app, data]) => ({
        app,
        count: data.count,
        lastDate: data.lastDate,
        sites: data.sites
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.lastDate - a.lastDate;
      });

    // Display grouped screenshots
    sortedApps.forEach(appGroup => {
      const appElement = document.createElement('div');
      appElement.className = 'screenshot-group';
      
      const lastDate = new Date(appGroup.lastDate);
      const formattedDate = lastDate.toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      // Check if there are multiple sites for this app
      const siteEntries = Object.entries(appGroup.sites);
      const hasMultipleSites = siteEntries.length > 1;
      
      let sitesHtml = '';
      if (hasMultipleSites) {
        // Sort sites by count and date
        const sortedSites = siteEntries
          .map(([title, siteData]) => ({
            title,
            count: siteData.count,
            lastDate: siteData.lastDate,
            screenshots: siteData.screenshots
          }))
          .sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return b.lastDate - a.lastDate;
          });

        sitesHtml = `
          <div class="screenshot-sites" style="display: none; margin-top: 10px; padding-left: 15px; border-left: 2px solid #e0e0e0;">
            ${sortedSites.map(site => {
              const siteLastDate = new Date(site.lastDate);
              const siteFormattedDate = siteLastDate.toLocaleDateString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
              });
              
              return `
                <div class="screenshot-site" style="margin-bottom: 8px; padding: 8px; background-color: #f5f5f5; border-radius: 4px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                    <div style="font-size: 12px; color: #333; font-weight: 500;">${site.title}</div>
                    <div style="background-color: #666; color: white; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: 500;">${site.count}</div>
                  </div>
                  <div style="font-size: 10px; color: #666; font-style: italic;">Last: ${siteFormattedDate}</div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      // Add arrow indicator for expandable items
      const arrowIcon = hasMultipleSites ? '▼' : '';
      const arrowStyle = hasMultipleSites ? 'margin-right: 8px; font-size: 10px; color: #666; transition: transform 0.2s;' : '';

      appElement.innerHTML = `
        <div class="screenshot-group-header" style="cursor: ${hasMultipleSites ? 'pointer' : 'default'};">
          <div style="display: flex; align-items: center;">
            <span style="${arrowStyle}" class="arrow-icon">${arrowIcon}</span>
            <div class="screenshot-title">${appGroup.app}</div>
          </div>
          <div class="screenshot-count">${appGroup.count}</div>
        </div>
        <div class="screenshot-last-date">Last: ${formattedDate}</div>
        ${sitesHtml}
      `;

      // Add click handler for expanding/collapsing sites
      if (hasMultipleSites) {
        const header = appElement.querySelector('.screenshot-group-header');
        const sitesContainer = appElement.querySelector('.screenshot-sites');
        const arrowIcon = appElement.querySelector('.arrow-icon');
        
        header.addEventListener('click', () => {
          const isVisible = sitesContainer.style.display !== 'none';
          sitesContainer.style.display = isVisible ? 'none' : 'block';
          
          // Rotate arrow and add visual indicator for expanded state
          if (isVisible) {
            arrowIcon.style.transform = 'rotate(0deg)';
            header.style.backgroundColor = 'transparent';
          } else {
            arrowIcon.style.transform = 'rotate(180deg)';
            header.style.backgroundColor = '#f0f0f0';
          }
        });
        
        // Add hover effect
        header.addEventListener('mouseenter', () => {
          if (hasMultipleSites) {
            header.style.backgroundColor = '#f8f8f8';
          }
        });
        
        header.addEventListener('mouseleave', () => {
          if (sitesContainer.style.display === 'none') {
            header.style.backgroundColor = 'transparent';
          }
        });
      }

      container.appendChild(appElement);
    });
  }

  function updateSectionHeader(sectionId, count) {
    const section = document.getElementById(sectionId);
    if (section) {
      const titleElement = section.querySelector('.screenshot-period-title');
      if (titleElement) {
        const originalText = titleElement.textContent.split(' (')[0]; // Remove existing count if any
        titleElement.textContent = `${originalText} (${count})`;
      }
    }
  }

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
    if (hours === 0) return '0h';
    if (hours < 0) return `-${formatHours(Math.abs(hours))}`;
    
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
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

  // Get remaining working days this week
  function getRemainingWorkingDaysThisWeek() {
    const now = new Date();
    const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    
    if (currentDay === 0 || currentDay === 6) return 0; // Weekend
    
    return Math.max(0, 5 - currentDay); // Remaining days including today
  }

  // Get remaining working days this month
  function getRemainingWorkingDaysThisMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let remainingWorkingDays = 0;
    
    for (let day = today; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        remainingWorkingDays++;
      }
    }
    
    return remainingWorkingDays;
  }

  // Get remaining hours today
  function getRemainingHoursToday() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    if (currentHour < WORK_START_HOUR) {
      return WORK_END_HOUR - WORK_START_HOUR; // Full day available
    }
    
    if (currentHour >= WORK_END_HOUR) {
      return 0; // Work day ended
    }
    
    const currentTime = currentHour + currentMinute / 60;
    return Math.max(0, WORK_END_HOUR - currentTime);
  }

  // Calculate days passed this week
  function getDaysPassedThisWeek() {
    const now = new Date();
    const currentDay = now.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    
    if (currentDay === 0) return 0; // Sunday
    if (currentDay === 6) return 5; // Saturday
    
    return currentDay; // Monday=1, Tuesday=2, ..., Friday=5
  }

  // Calculate days passed this month
  function getDaysPassedThisMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    
    let workingDaysPassed = 0;
    
    for (let day = 1; day < today; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        workingDaysPassed++;
      }
    }
    
    return workingDaysPassed;
  }

  // Update progress bar
  function updateProgressBar(elementId, percentage, status) {
    const progressBar = document.getElementById(elementId);
    const progressText = document.getElementById(elementId.replace('Bar', 'Text'));
    
    if (progressBar && progressText) {
      progressBar.style.width = `${Math.min(percentage, 100)}%`;
      progressBar.className = 'progress-bar';
      
      if (status === 'ahead') {
        progressBar.classList.add('over');
      } else if (status === 'behind') {
        progressBar.classList.add('behind');
      } else if (status === 'critical') {
        progressBar.classList.add('critical');
      }
      
      progressText.textContent = `${Math.round(percentage)}%`;
    }
  }

  // Update status indicator
  function updateStatusIndicator(elementId, status, text) {
    const statusElement = document.getElementById(elementId);
    if (statusElement) {
      statusElement.textContent = text;
      statusElement.className = 'status-indicator';
      statusElement.classList.add(`status-${status}`);
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
    
    // Projection text
    const weeklyGap = WEEKLY_TARGET - weekWorked;
    const avgNeeded = remainingDays > 0 ? weeklyGap / remainingDays : 0;
    
    let projectionText = '';
    if (weekWorked >= WEEKLY_TARGET) {
      projectionText = `Week target reached! ${formatHours(weekWorked - WEEKLY_TARGET)} over target.`;
    } else if (remainingDays > 0) {
      projectionText = `Need ${formatHours(avgNeeded)} per day for remaining ${remainingDays} days to reach target.`;
    } else {
      projectionText = `Week ended. ${formatHours(weeklyGap)} short of target.`;
    }
    
    // Capacity gap info for weekly
    const weeklyCapacity = remainingDays * DAILY_TARGET;
    const weeklyCapacityGap = weeklyRemaining - weeklyCapacity;
    
    let weeklyCapacityGapText = '';
    if (weeklyCapacityGap > 0) {
      weeklyCapacityGapText = `⚠️ ${formatHours(weeklyCapacityGap)} behind schedule (need to catch up)`;
    } else if (weeklyCapacityGap < 0) {
      weeklyCapacityGapText = `✅ ${formatHours(Math.abs(weeklyCapacityGap))} ahead of schedule`;
    } else {
      weeklyCapacityGapText = `✅ Perfectly on schedule`;
    }
    
    return {
      worked: weekWorked,
      remaining: weeklyRemaining,
      progress: weekProgress,
      status: weekStatus,
      statusText: weekStatusText,
      projectionText: projectionText,
      capacityGapText: weeklyCapacityGapText
    };
  }

  // Calculate monthly metrics
  function calculateMonthlyMetrics(monthWork) {
    const monthWorked = parseTimeToHours(monthWork);
    const now = new Date();
    const monthTarget = getWorkingDaysInMonth(now.getFullYear(), now.getMonth()) * DAILY_TARGET;
    const daysPassedThisMonth = getDaysPassedThisMonth();
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
    
    // Projection text
    const monthlyGap = monthTarget - monthWorked;
    const avgNeeded = remainingDays > 0 ? monthlyGap / remainingDays : 0;
    
    let projectionText = '';
    if (monthWorked >= monthTarget) {
      projectionText = `Month target reached! ${formatHours(monthWorked - monthTarget)} over target.`;
    } else if (remainingDays > 0) {
      projectionText = `Need ${formatHours(avgNeeded)} per day for remaining ${remainingDays} days to reach target.`;
    } else {
      projectionText = `Month ended. ${formatHours(monthlyGap)} short of target.`;
    }
    
    // Capacity gap info
    let capacityGapText = '';
    if (capacityGap > 0) {
      capacityGapText = `⚠️ ${formatHours(capacityGap)} behind schedule (need to catch up)`;
    } else if (capacityGap < 0) {
      capacityGapText = `✅ ${formatHours(Math.abs(capacityGap))} ahead of schedule`;
    } else {
      capacityGapText = `✅ Perfectly on schedule`;
    }
    
    return {
      worked: monthWorked,
      remaining: monthlyRemaining,
      progress: monthProgress,
      status: monthStatus,
      statusText: monthStatusText,
      projectionText: projectionText,
      capacityGapText: capacityGapText
    };
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

  // Initialize tabs
  initializeTabs();

  // Initially show loading, hide stats and error
  loadingDiv.classList.remove('hidden');
  statsContainer.classList.add('hidden');
  errorMessageDiv.classList.add('hidden');
  userNameDiv.textContent = 'Loading user...';
  lastUpdatedDiv.textContent = '';

  // Clear any existing interval
  if (timeAgoInterval) {
    clearInterval(timeAgoInterval);
  }

  // Request data from background script
  chrome.runtime.sendMessage({ action: 'getAggregatedTimes' }, (response) => {
    loadingDiv.classList.add('hidden');

    if (response && response.lastUpdated) {
      lastUpdateTimeGlobal = response.lastUpdated;
      updateLastUpdatedText();
      if (lastUpdateTimeGlobal) {
        if (timeAgoInterval) clearInterval(timeAgoInterval);
        timeAgoInterval = setInterval(updateLastUpdatedText, 1000);
      }
    } else {
      lastUpdateTimeGlobal = null;
      updateLastUpdatedText();
    }

    // Handle errors
    if (chrome.runtime.lastError) {
      errorMessageDiv.textContent = 'Runtime Error: ' + chrome.runtime.lastError.message;
      errorMessageDiv.classList.remove('hidden');
      statsContainer.classList.add('hidden');
      userNameDiv.textContent = '-';
      if (timeAgoInterval) clearInterval(timeAgoInterval);
      lastUpdateTimeGlobal = null;
      updateLastUpdatedText();
      return;
    }

    if (response && response.error && 
        (response.error.toLowerCase().includes('token not found') || 
         response.error.toLowerCase().includes('unauthorized'))) {
      errorMessageDiv.innerHTML = `Please log in to <a href="https://app.insightful.io/" target="_blank" style="color: #5e35b1;">Insightful.io</a> first, then try again.`;
      errorMessageDiv.classList.remove('hidden');
      statsContainer.classList.add('hidden');
      userNameDiv.textContent = '-';
      if(openDashboardLink) openDashboardLink.parentElement.classList.add('hidden');
      lastUpdatedDiv.classList.add('hidden');
      if (timeAgoInterval) clearInterval(timeAgoInterval);
      lastUpdateTimeGlobal = null;
      updateLastUpdatedText();
      return;
    }
    
    if(openDashboardLink) openDashboardLink.parentElement.classList.remove('hidden');
    lastUpdatedDiv.classList.remove('hidden');

    if (response && response.error) {
      errorMessageDiv.textContent = 'Error: ' + response.error;
      errorMessageDiv.classList.remove('hidden');
      if (response.data && response.data.userName) {
         userNameDiv.textContent = response.data.userName;
      } else {
         userNameDiv.textContent = 'User: Error';
      }
      if (!response.data || Object.keys(response.data).length <= 2) { 
            statsContainer.classList.add('hidden');
      }
    }

    // Process and display data
    if (response && response.data) {
      const data = response.data;
      userNameDiv.textContent = data.userName || '-';

      if (data.userProfileError && (!response.error || response.error === data.userProfileError)) {
        let currentErrorText = errorMessageDiv.textContent;
        let profileErrorMsg = 'User Profile: ' + data.userProfileError;
        errorMessageDiv.textContent = currentErrorText && !currentErrorText.includes(profileErrorMsg) ? `${currentErrorText} | ${profileErrorMsg}` : profileErrorMsg;
        if (profileErrorMsg && profileErrorMsg.trim() !== 'User Profile:') errorMessageDiv.classList.remove('hidden');
      }

      // Calculate all metrics
      const dailyMetrics = calculateDailyMetrics(data.today?.work, data.yesterday?.work);
      const weeklyMetrics = calculateWeeklyMetrics(data.thisWeek?.work);
      const monthlyMetrics = calculateMonthlyMetrics(data.thisMonth?.work);

      // Update Daily section
      document.getElementById('todayWork').textContent = formatHours(dailyMetrics.today.worked);
      document.getElementById('todayIdle').textContent = formatHours(parseTimeToHours(data.today?.idle || '-'));
      document.getElementById('todayRemaining').textContent = formatHours(dailyMetrics.today.remaining);
      document.getElementById('yesterdayWork').textContent = formatHours(dailyMetrics.yesterday.worked);
      document.getElementById('yesterdayIdle').textContent = formatHours(parseTimeToHours(data.yesterday?.idle || '-'));
      
      updateProgressBar('todayProgressBar', dailyMetrics.today.progress, dailyMetrics.today.status);
      updateProgressBar('yesterdayProgressBar', dailyMetrics.yesterday.progress, dailyMetrics.yesterday.status);
      
      updateStatusIndicator('todayStatus', dailyMetrics.today.status, dailyMetrics.today.statusText);
      updateStatusIndicator('yesterdayStatus', dailyMetrics.yesterday.status, dailyMetrics.yesterday.statusText);

      // Update Weekly section
      document.getElementById('weekWork').textContent = formatHours(weeklyMetrics.worked);
      document.getElementById('weekIdle').textContent = formatHours(parseTimeToHours(data.thisWeek?.idle || '-'));
      document.getElementById('weekRemaining').textContent = formatHours(weeklyMetrics.remaining);
      document.getElementById('weekProjection').textContent = weeklyMetrics.projectionText;
      document.getElementById('weekCapacityGap').textContent = weeklyMetrics.capacityGapText;
      
      updateProgressBar('weekProgressBar', weeklyMetrics.progress, weeklyMetrics.status);
      updateStatusIndicator('weekStatus', weeklyMetrics.status, weeklyMetrics.statusText);

      // Update Monthly section
      document.getElementById('monthWork').textContent = formatHours(monthlyMetrics.worked);
      document.getElementById('monthIdle').textContent = formatHours(parseTimeToHours(data.thisMonth?.idle || '-'));
      document.getElementById('monthRemaining').textContent = formatHours(monthlyMetrics.remaining);
      document.getElementById('monthProjection').textContent = monthlyMetrics.projectionText;
      document.getElementById('monthCapacityGap').textContent = monthlyMetrics.capacityGapText;
      
      updateProgressBar('monthProgressBar', monthlyMetrics.progress, monthlyMetrics.status);
      updateStatusIndicator('monthStatus', monthlyMetrics.status, monthlyMetrics.statusText);

      statsContainer.classList.remove('hidden');
    } else if (!response.error) {
      errorMessageDiv.textContent = 'Error: No data received or data is in unexpected format.';
      errorMessageDiv.classList.remove('hidden');
      statsContainer.classList.add('hidden');
      userNameDiv.textContent = '-';
      if (timeAgoInterval) clearInterval(timeAgoInterval);
      lastUpdateTimeGlobal = null;
      updateLastUpdatedText();
    }
  });
}); 