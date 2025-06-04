async function getTokenFromLocalStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['activeToken'], (result) => {
      try {
        if (!result.activeToken) {
          return resolve(null);
        }
        const parsed = JSON.parse(result.activeToken);
        const tokenValue = parsed.token?.token || null;
        resolve(tokenValue);
      } catch (e) {
        resolve(null);
      }
    });
  });
}

let lastWork = '-';
let lastIdle = '-';

function msToHourMinute(ms) {
  if (ms === null || ms === undefined || isNaN(ms)) return '-';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

async function fetchUtilization(start, end) {
  const token = await getTokenFromLocalStorage();
  if (!token) {
    return { workTime: null, idleTime: null, error: 'Token not found. Please set it in options.' };
  }
  const url = `https://app.insightful.io/api/v2/insights/utilization/employee?start=${start}&end=${end}`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "accept": "application/json, text/plain, */*",
        "authorization": `Bearer ${token}`
      },
      credentials: "include"
    });
    if (!response.ok) {
      let errorMessage = `API Error ${response.status}`;
      if (response.status === 401) errorMessage = 'Unauthorized. Check your token.';
      return { workTime: null, idleTime: null, error: errorMessage };
    }
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      let totalWorkTime = 0;
      let totalIdleTime = 0;
      data.forEach(item => {
        totalWorkTime += (item.workTime || 0);
        totalIdleTime += (item.idleTime || 0);
      });
      return { workTime: totalWorkTime, idleTime: totalIdleTime };
    } else if (Array.isArray(data) && data.length === 0) {
      return { workTime: 0, idleTime: 0 };
    } else {
      return { workTime: null, idleTime: null, error: 'Unexpected API response format.' };
    }
  } catch (error) {
    return { workTime: null, idleTime: null, error: error?.message || String(error) };
  }
}

// Helper function to get start and end of today in UTC
function getTodayUTCTimestamps() {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999);
  return { start, end };
}

// Helper function to get start and end of the current week (Mon-Sun) in UTC
function getThisWeekUTCTimestamps() {
  const now = new Date();
  const todayUTC = now.getUTCDay();
  const diffToMondayUTC = todayUTC === 0 ? -6 : 1 - todayUTC;
  const startOfWeekDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMondayUTC, 0, 0, 0, 0));
  const endOfWeekDate = new Date(Date.UTC(startOfWeekDate.getUTCFullYear(), startOfWeekDate.getUTCMonth(), startOfWeekDate.getUTCDate() + 6, 23, 59, 59, 999));
  return { start: startOfWeekDate.getTime(), end: endOfWeekDate.getTime() };
}

// Helper function to get start and end of the current month in UTC
function getThisMonthUTCTimestamps() {
  const now = new Date();
  const startOfMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0);
  const endOfMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999);
  return { start: startOfMonth, end: endOfMonth };
}

// Helper function to get start and end of the last week (Mon-Sun) in UTC
function getLastWeekUTCTimestamps() {
  const now = new Date();
  const todayUTC = now.getUTCDay();
  const diffToMondayUTC = todayUTC === 0 ? -6 : 1 - todayUTC;
  const currentMondayStartDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMondayUTC, 0, 0, 0, 0));
  const startOfLastWeek = new Date(currentMondayStartDate.getTime() - 7 * 24 * 60 * 60 * 1000);
  const endOfLastWeek = new Date(Date.UTC(startOfLastWeek.getUTCFullYear(), startOfLastWeek.getUTCMonth(), startOfLastWeek.getUTCDate() + 6, 23, 59, 59, 999));
  return { start: startOfLastWeek.getTime(), end: endOfLastWeek.getTime() };
}

// Helper function to get start and end of the last month in UTC
function getLastMonthUTCTimestamps() {
  const now = new Date();
  const startOfLastMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0);
  const endOfLastMonth = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999);
  return { start: startOfLastMonth, end: endOfLastMonth };
}

// Helper function to get start and end of Yesterday in UTC
function getYesterdayUTCTimestamps() {
  const now = new Date();
  const yesterdayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0);
  const yesterdayEnd = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 23, 59, 59, 999);
  return { start: yesterdayStart, end: yesterdayEnd };
}

// Function to fetch user profile information (e.g., name)
async function fetchUserProfile() {
  const token = await getTokenFromLocalStorage();
  if (!token) {
    return { name: 'User (Token N/A)', error: 'Token not found.' };
  }
  const url = `https://app.insightful.io/api/v1/me?ts=${Date.now()}`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "accept": "application/json, text/plain, */*",
        "authorization": `Bearer ${token}`
      },
      credentials: "include"
    });
    if (!response.ok) {
      let errorMessage = `User Profile API Error ${response.status}`;
      if (response.status === 401) errorMessage = 'Unauthorized. Check token for profile.';
      return { name: 'User (API Error)', error: errorMessage };
    }
    const data = await response.json();
    return { name: data.name || 'User (Name N/A)', error: null };
  } catch (error) {
    return { name: 'User (Fetch Error)', error: error?.message || String(error) };
  }
}

// Popup'tan gelen mesajı dinle
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTimes') {
    const { start, end } = getTodayUTCTimestamps();
    fetchUtilization(start, end)
      .then(data => {
        if (data.error) {
          sendResponse({ work: '-', idle: '-', error: data.error });
        } else {
          sendResponse({ work: msToHourMinute(data.workTime), idle: msToHourMinute(data.idleTime) });
        }
      })
      .catch(error => {
        sendResponse({ work: '-', idle: '-', error: error?.message || String(error) });
      });
    return true;
  }
  
  if (request.action === 'getAggregatedTimes') {
    const todayTs = getTodayUTCTimestamps();
    const yesterdayTs = getYesterdayUTCTimestamps();
    const weekTs = getThisWeekUTCTimestamps();
    const monthTs = getThisMonthUTCTimestamps();
    const lastWeekTs = getLastWeekUTCTimestamps();
    const lastMonthTs = getLastMonthUTCTimestamps();

    Promise.all([
      fetchUserProfile(),
      fetchUtilization(todayTs.start, todayTs.end),
      fetchUtilization(yesterdayTs.start, yesterdayTs.end),
      fetchUtilization(weekTs.start, weekTs.end),
      fetchUtilization(monthTs.start, monthTs.end),
      fetchUtilization(lastWeekTs.start, lastWeekTs.end),
      fetchUtilization(lastMonthTs.start, lastMonthTs.end)
    ]).then(([profileData, todayData, yesterdayData, weekData, monthData, lastWeekData, lastMonthData]) => {
      const lastUpdatedTimestamp = Date.now();
      const responseData = {
        userName: profileData.name,
        userProfileError: profileData.error,
        today: {
          work: msToHourMinute(todayData.workTime),
          idle: msToHourMinute(todayData.idleTime),
          error: todayData.error
        },
        yesterday: {
          work: msToHourMinute(yesterdayData.workTime),
          idle: msToHourMinute(yesterdayData.idleTime),
          error: yesterdayData.error
        },
        thisWeek: {
          work: msToHourMinute(weekData.workTime),
          idle: msToHourMinute(weekData.idleTime),
          error: weekData.error
        },
        thisMonth: {
          work: msToHourMinute(monthData.workTime),
          idle: msToHourMinute(monthData.idleTime),
          error: monthData.error
        },
        lastWeek: {
          work: msToHourMinute(lastWeekData.workTime),
          idle: msToHourMinute(lastWeekData.idleTime),
          error: lastWeekData.error
        },
        lastMonth: {
          work: msToHourMinute(lastMonthData.workTime),
          idle: msToHourMinute(lastMonthData.idleTime),
          error: lastMonthData.error
        }
      };
      
      let globalError = profileData.error || todayData.error || yesterdayData.error || weekData.error || monthData.error || lastWeekData.error || lastMonthData.error;
      
      const responsePayload = { data: responseData, error: globalError, lastUpdated: lastUpdatedTimestamp };
      sendResponse(responsePayload);

    }).catch(error => {
      const errorResponse = { data: null, error: error?.message || String(error), lastUpdated: Date.now() };
      sendResponse(errorResponse);
    });
    return true;
  }

  if (request.action === 'saveToken' && request.token) {
    chrome.storage.local.set({ activeToken: request.token }, () => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true });
      }
    });
    return true;
  }
}); 