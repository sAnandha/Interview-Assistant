const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://your-api-gateway-url.execute-api.region.amazonaws.com';

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async createSession(userId, interviewType = 'behavioral', difficulty = 'medium') {
    return this.request('/sessions', {
      method: 'POST',
      body: JSON.stringify({ userId, interviewType, difficulty }),
    });
  }

  async getQuestion(sessionId) {
    return this.request(`/sessions/${sessionId}/question`);
  }

  async recordTranscript(sessionId, transcript, questionIndex, audioUrl = null) {
    return this.request(`/sessions/${sessionId}/transcript`, {
      method: 'POST',
      body: JSON.stringify({ transcript, questionIndex, audioUrl }),
    });
  }

  async scoreSession(sessionId) {
    return this.request(`/sessions/${sessionId}/score`, {
      method: 'POST',
    });
  }
}

export default new ApiService();