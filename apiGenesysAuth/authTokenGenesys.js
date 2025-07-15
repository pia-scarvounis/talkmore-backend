import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Denne skal hente Oatuh2 token for ekstern API
export async function getOAuthToken() {
    const url = 'https://login.mypurecloud.de/oauth/token';  // Endre dette basert på regionen
    const client_id = process.env.CLIENT_ID;
    const client_secret = process.env.CLIENT_SECRET;
  
    const data = new URLSearchParams();
    data.append('grant_type', 'client_credentials');
    data.append('client_id', client_id);
    data.append('client_secret', client_secret);
  
    try {
      const response = await axios.post(url, data, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      return response.data.access_token;  // Returner access token
    } catch (error) {
      console.error('Error fetching OAuth token:', error);
      throw new Error('Unable to fetch OAuth token');
    }
  }