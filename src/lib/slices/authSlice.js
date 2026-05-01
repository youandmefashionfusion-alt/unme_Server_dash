// store/slices/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

const TOKEN_KEY = 'adminAuthToken';
const USER_KEY = 'userData';
const REMEMBER_KEY = 'adminRememberMe';

const hasWindow = () => typeof window !== 'undefined';

const clearAuthStorage = () => {
  if (!hasWindow()) return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REMEMBER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
};

const readStoredAuth = () => {
  if (!hasWindow()) {
    return { token: null, rememberMe: false, user: null };
  }

  const localToken = localStorage.getItem(TOKEN_KEY);
  const sessionToken = sessionStorage.getItem(TOKEN_KEY);
  const rememberMe = localStorage.getItem(REMEMBER_KEY) === '1';

  let token = null;
  let userRaw = null;
  let fromRememberedStorage = false;

  if (localToken) {
    token = localToken;
    userRaw = localStorage.getItem(USER_KEY);
    fromRememberedStorage = true;
  } else if (sessionToken) {
    token = sessionToken;
    userRaw = sessionStorage.getItem(USER_KEY);
    fromRememberedStorage = false;
  }

  let user = null;
  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch {
      user = null;
    }
  }

  return {
    token,
    user,
    rememberMe: fromRememberedStorage ? true : false,
  };
};

const persistAuth = (user, rememberMe) => {
  if (!hasWindow()) return;

  const token = user?.token;
  if (!token) {
    clearAuthStorage();
    return;
  }

  const serializedUser = JSON.stringify(user);

  if (rememberMe) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, serializedUser);
    localStorage.setItem(REMEMBER_KEY, '1');
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    return;
  }

  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USER_KEY, serializedUser);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REMEMBER_KEY);
};

// Async thunks
export const checkAuthStatus = createAsyncThunk(
  'auth/checkStatus',
  async () => {
    const { token: adminAuthToken, rememberMe, user: cachedUser } = readStoredAuth();

    const headers = {};
    if (adminAuthToken) {
      headers['Authorization'] = `Bearer ${adminAuthToken}`;
    }

    const response = await fetch('/api/user/session', {
      headers,
      credentials: 'include',
    });

    const session = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (
        [401, 403].includes(response.status)
      ) {
        clearAuthStorage();
      }

      if ([401, 403].includes(response.status)) {
        return {
          user: null,
          isAuthenticated: false,
          error: session?.error || 'Session expired',
        };
      }

      // Graceful fallback for transient route/server errors.
      if (
        [404, 429, 500, 502, 503, 504].includes(response.status) &&
        adminAuthToken &&
        cachedUser
      ) {
        return {
          user: cachedUser,
          isAuthenticated: true,
          stale: true,
        };
      }

      throw new Error(session?.error || 'Session check failed');
    }

    if (session?.user?.token) {
      persistAuth(session.user, rememberMe);
    }

    return session;
  }
);

// In your loginUser thunk
export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ mobile, password, rememberMe = false }, { rejectWithValue }) => {
    try {
      const normalizedMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
      const response = await fetch('/api/user/admin-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mobile: normalizedMobile, password, rememberMe }),
      });

      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.message || 'Login failed');
      }

      if (data?.user?.token) {
        persistAuth(data.user, Boolean(rememberMe));
      }

      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// export const registerUser = createAsyncThunk(
//   'auth/register',
//   async (userData, { rejectWithValue }) => {
//     try {
//       const response = await fetch('/api/web/user/create-user', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(userData),
//       })

//       const data = await response.json()

//       if (!response.ok) {
//         return rejectWithValue(data.error || 'Registration failed')
//       }

//       return data
//     } catch (error) {
//       return rejectWithValue(error.message)
//     }
//   }
// )

// store/slices/authSlice.js
export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      const { token: adminAuthToken } = readStoredAuth();

      const headers = {
        'Content-Type': 'application/json',
      };

      // Add Authorization header if token exists
      if (adminAuthToken) {
        headers['Authorization'] = `Bearer ${adminAuthToken}`;
      }

      await fetch('/api/user/logout', { 
        method: 'POST',
        headers
      });
      
      clearAuthStorage();
      if (hasWindow()) localStorage.removeItem('localCart');

      return true;
    } catch (error) {
      clearAuthStorage();
      if (hasWindow()) localStorage.removeItem('localCart');
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isAuthenticated: false,
    loading: true,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null
    },
    setUser: (state, action) => {
      state.user = action.payload
      state.isAuthenticated = !!action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      // Check Auth Status
      .addCase(checkAuthStatus.pending, (state) => {
        state.loading = true
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.isAuthenticated = action.payload.isAuthenticated
        state.error = action.payload?.error || null
      })
      .addCase(checkAuthStatus.rejected, (state) => {
        state.loading = false
        state.isAuthenticated = false
        state.user = null
      })
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.isAuthenticated = true
        state.error = null
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload
        state.isAuthenticated = false
        state.user = null
      })
      // Register
      // .addCase(registerUser.pending, (state) => {
      //   state.loading = true
      //   state.error = null
      // })
      // .addCase(registerUser.fulfilled, (state) => {
      //   state.loading = false
      //   state.error = null
      // })
      // .addCase(registerUser.rejected, (state, action) => {
      //   state.loading = false
      //   state.error = action.payload
      // })
      // Logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null
        state.isAuthenticated = false
        state.loading = false
        state.error = null
      })
  },
})

export const { clearError, setUser } = authSlice.actions
export default authSlice.reducer
