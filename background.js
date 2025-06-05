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

// New function to refresh the access token using a refresh token
async function refreshAccessTokenAndStore(refreshTokenValue) {
  const url = "https://app.insightful.io/api/v1/auth/refresh-token";
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json, text/plain, */*"
      },
      body: JSON.stringify({ refreshToken: refreshTokenValue })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let detail = `Refresh token API error ${response.status}: ${errorText}`;
      if (response.status === 401 || response.status === 400) {
        chrome.storage.local.remove(['activeToken', 'refreshToken'], () => {
          if (chrome.runtime.lastError) {
            console.error("Error removing tokens after refresh failure:", chrome.runtime.lastError);
          }
        });
        detail = `Token refresh failed (auth error ${response.status}). Please re-configure token.`;
      }
      return { value: null, errorDetail: detail };
    }

    const data = await response.json();
    if (data.tokens && data.tokens.length > 0 && data.tokens[0].token && data.refreshToken) {
      const newActiveTokenObject = data.tokens[0];
      const newRefreshTokenString = data.refreshToken;

      await new Promise(resolveSet => {
        chrome.storage.local.set({
          activeToken: JSON.stringify(newActiveTokenObject),
          refreshToken: newRefreshTokenString
        }, () => {
          if (chrome.runtime.lastError) {
            console.error("Error saving new tokens:", chrome.runtime.lastError);
            // Even if saving fails, we got a token, but it won't persist for next time.
          }
          resolveSet();
        });
      });
      return { value: newActiveTokenObject.token, errorDetail: null };
    } else {
      return { value: null, errorDetail: "Unexpected refresh token API response format." };
    }
  } catch (error) {
    return { value: null, errorDetail: `Network or other error during token refresh: ${error?.message || String(error)}` };
  }
}

// Helper to decode JWT and get expiry
function getExpiryFromJWT(token) {
  if (!token) return null;
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;
    // Ensure correct Base64URL decoding
    const correctedBase64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = JSON.parse(atob(correctedBase64));
    return decodedPayload.exp || null; // exp is in seconds
  } catch (e) {
    console.error("Failed to decode JWT or get exp", e);
    return null;
  }
}

// New function to get a valid access token, refreshing if necessary
async function getAccessToken() {
  return new Promise(async (resolve) => { // Added async here for await inside
    chrome.storage.local.get(['activeToken', 'refreshToken'], async (result) => {
      try {
        const storedActiveTokenString = result.activeToken;
        const storedRefreshTokenString = result.refreshToken;
        let activeTokenError = null;

        if (storedActiveTokenString) {
          try {
            const parsedStoredToken = JSON.parse(storedActiveTokenString);
            // Corrected path to the JWT string based on user-provided structure
            if (parsedStoredToken && parsedStoredToken.token && typeof parsedStoredToken.token.token === 'string') {
              const jwtString = parsedStoredToken.token.token;
              // No need for an explicit typeof check here again if the path implies it.
              const expiryTimestampSeconds = getExpiryFromJWT(jwtString);
              if (expiryTimestampSeconds && (expiryTimestampSeconds * 1000 > Date.now() - 60000)) {
                resolve({ value: jwtString, errorDetail: null });
                return;
              } else {
                // activeTokenData.token.token is a valid JWT string, but it's expired or has no exp
                activeTokenError = expiryTimestampSeconds ? "Active token is expired." : "Could not determine expiry for active token.";
              }
            } else {
              // parsedStoredToken.token.token is not a string or the structure is broken
              activeTokenError = "Stored active token is invalid (missing token.token string or unexpected structure).";
            }
          } catch (e) {
            activeTokenError = `Failed to parse stored active token: ${e.message}`;
          }
        } else {
          // No storedActiveTokenString at all
          activeTokenError = "No active token found in storage.";
        }

        // If active token is invalid, expired, or not found, try to refresh
        if (storedRefreshTokenString) {
          // Enters here even if activeTokenError is populated (e.g., "Active token is expired.") and tries to refresh.
          console.log(activeTokenError || "Attempting token refresh as active token is unavailable/invalid.");
          const refreshResult = await refreshAccessTokenAndStore(storedRefreshTokenString);
          resolve(refreshResult);
        } else {
          // Both active token is problematic/non-existent, and no refresh token.
          const finalError = activeTokenError || "No active token and no refresh token available.";
          console.log("No refresh token. Cannot refresh. Final error: ", finalError);
          resolve({ value: null, errorDetail: finalError });
        }
      } catch (e) {
        const catchError = `Critical error in getAccessToken: ${e.message}`;
        console.error(catchError, e);
        resolve({ value: null, errorDetail: catchError });
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
  const tokenInfo = await getAccessToken();
  if (!tokenInfo || !tokenInfo.value) {
    return { workTime: null, idleTime: null, error: tokenInfo?.errorDetail || 'Token acquisition failed. Check configuration or logs.' };
  }
  const token = tokenInfo.value;
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
  const tokenInfo = await getAccessToken();
  if (!tokenInfo || !tokenInfo.value) {
    return { name: 'User (Token Error)', error: tokenInfo?.errorDetail || 'Token acquisition failed for profile. Check logs.' };
  }
  const token = tokenInfo.value;
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

  if (request.action === 'saveToken' && request.tokensToSave) {
    const { activeTokenObjectToStore, refreshTokenToStore } = request.tokensToSave;
    if (
      activeTokenObjectToStore &&
      typeof activeTokenObjectToStore.token === 'object' &&
      typeof activeTokenObjectToStore.token.token === 'string' &&
      typeof refreshTokenToStore === 'string'
    ) {
      chrome.storage.local.set({
        activeToken: JSON.stringify(activeTokenObjectToStore),
        refreshToken: refreshTokenToStore
      }, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
    } else {
      sendResponse({ success: false, error: "Invalid token structure. Ensure activeTokenObjectToStore (with .token string) and refreshTokenToStore (string) are provided." });
    }
    return true;
  }
}); 