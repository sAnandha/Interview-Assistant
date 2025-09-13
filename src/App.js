import React, { useState } from 'react';
import InterviewSession from './components/InterviewSession';
import Results from './components/Results';
import ApiService from './services/api';
import AuthWrapper from './Auth';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('setup'); // setup, interview, results
  const [sessionId, setSessionId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [interviewType, setInterviewType] = useState('behavioral');
  const [difficulty, setDifficulty] = useState('medium');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const startInterview = async (e) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      setError('');
      
      const userId = userEmail || 'anonymous';
      const response = await ApiService.createSession(userId, interviewType, difficulty);
      
      setSessionId(response.sessionId);
      setCurrentView('interview');
    } catch (err) {
      setError('Failed to start interview: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInterviewComplete = () => {
    setCurrentView('results');
  };

  const handleRestart = () => {
    setCurrentView('setup');
    setSessionId('');
    setError('');
  };

  const renderSetupView = () => (
    <div className="setup-view">
      <div className="setup-container">
        <h1>Mock Interview Assistant</h1>
        <p>Practice your interview skills with AI-powered feedback</p>
        
        <form onSubmit={startInterview} className="setup-form">
          <div className="form-group">
            <label htmlFor="email">Email (Optional)</label>
            <input
              type="email"
              id="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="your.email@example.com"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="interviewType">Interview Type</label>
            <select
              id="interviewType"
              value={interviewType}
              onChange={(e) => setInterviewType(e.target.value)}
            >
              <option value="behavioral">Behavioral Questions</option>
              <option value="technical">Technical Questions</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="difficulty">Difficulty Level</label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          
          <button 
            type="submit" 
            className="start-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Starting...' : 'Start Interview'}
          </button>
        </form>
        
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <AuthWrapper>
      <div className="App">
        {currentView === 'setup' && renderSetupView()}
        {currentView === 'interview' && (
          <InterviewSession 
            sessionId={sessionId} 
            onComplete={handleInterviewComplete}
          />
        )}
        {currentView === 'results' && (
          <Results 
            sessionId={sessionId} 
            onRestart={handleRestart}
          />
        )}
      </div>
    </AuthWrapper>
  );
}

export default App;
