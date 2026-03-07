// store/slices/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

// Async thunks
export const checkAuthStatus = createAsyncThunk(
  'auth/checkStatus',
  async () => {
    // Get token from localStorage if available
    let adminAuthToken = null;
    if (typeof window !== 'undefined') {
      adminAuthToken = localStorage.getItem('adminAuthToken');
    }

    const headers = {};
    if (adminAuthToken) {
      headers['Authorization'] = `Bearer ${adminAuthToken}`;
    }

    const response = await fetch('/api/user/session', {
      headers
    });
    
    if (!response.ok) {
      throw new Error('Session check failed');
    }
    
    const session = await response.json();
    return session;
  }
);

// In your loginUser thunk
export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ mobile, password }, { rejectWithValue }) => {
    console.log(mobile,password)

    try {
      const response = await fetch('/api/user/admin-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mobile, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.message || 'Login failed');
      }

      // Store token in localStorage
      if (typeof window !== 'undefined' && data.user.token) {
        localStorage.setItem('adminAuthToken', data.user.token);
        localStorage.setItem('userData', JSON.stringify(data.user));
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
      // Get token from localStorage for Authorization header
      let adminAuthToken = null;
      if (typeof window !== 'undefined') {
        adminAuthToken = localStorage.getItem('adminAuthToken');
      }

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
      
      // Clear local storage regardless of API call success
      if (typeof window !== 'undefined') {
        localStorage.removeItem('adminAuthToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('localCart');
      }

      return true;
    } catch (error) {
      // Even if API call fails, clear local storage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('adminAuthToken');
        localStorage.removeItem('userData');
        localStorage.removeItem('localCart');
      }
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    isAuthenticated: true,
    loading: false,
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