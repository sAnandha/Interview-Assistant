import React, { useState, useEffect } from 'react';
import ApiService from '../services/api';

const Results = ({ sessionId, onRestart }) => {
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadResults();
  }, [sessionId]);

  const loadResults = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const data = await ApiService.scoreSession(sessionId);
      setResults(data);
    } catch (err) {
      setError('Failed to load results: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8) return '#4CAF50'; // Green
    if (score >= 6) return '#FF9800'; // Orange
    return '#F44336'; // Red
  };

  const getScoreLabel = (score) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Needs Improvement';
  };

  if (isLoading) {
    return (
      <div className="results loading">
        <div className="spinner">Analyzing your responses...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="results error">
        <h2>Error Loading Results</h2>
        <p>{error}</p>
        <button onClick={loadResults} className="retry-btn">
          Try Again
        </button>
      </div>
    );
  }

  if (!results) {
    return null;
  }

  return (
    <div className="results">
      <div className="results-header">
        <h2>Interview Results</h2>
        <div className="overall-score">
          <div className="score-circle" style={{ borderColor: getScoreColor(results.overallScore) }}>
            <span className="score-number">{results.overallScore.toFixed(1)}</span>
            <span className="score-max">/10</span>
          </div>
          <div className="score-label">
            {getScoreLabel(results.overallScore)}
          </div>
        </div>
      </div>

      <div className="summary-stats">
        <div className="stat">
          <span className="stat-number">{results.summary.excellent}</span>
          <span className="stat-label">Excellent</span>
        </div>
        <div className="stat">
          <span className="stat-number">{results.summary.good}</span>
          <span className="stat-label">Good</span>
        </div>
        <div className="stat">
          <span className="stat-number">{results.summary.needsImprovement}</span>
          <span className="stat-label">Needs Work</span>
        </div>
      </div>

      <div className="detailed-results">
        <h3>Question-by-Question Breakdown</h3>
        {results.scoredResponses.map((response, index) => (
          <div key={index} className="response-result">
            <div className="response-header">
              <span className="question-number">Question {response.questionIndex + 1}</span>
              <span 
                className="response-score"
                style={{ color: getScoreColor(response.score) }}
              >
                {response.score}/10
              </span>
            </div>
            
            <div className="response-transcript">
              <strong>Your Response:</strong>
              <p>{response.transcript}</p>
            </div>
            
            <div className="response-feedback">
              <strong>Feedback:</strong>
              <ul>
                {response.feedback.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="results-actions">
        <button onClick={onRestart} className="restart-btn">
          Start New Interview
        </button>
      </div>
    </div>
  );
};

export default Results;