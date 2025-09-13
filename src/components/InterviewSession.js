import React, { useState, useEffect } from 'react';
import ApiService from '../services/api';

const InterviewSession = ({ sessionId, onComplete }) => {
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [response, setResponse] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadNextQuestion();
  }, [sessionId]);

  const loadNextQuestion = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const data = await ApiService.getQuestion(sessionId);
      
      if (data.isComplete) {
        onComplete();
        return;
      }
      
      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setTotalQuestions(data.totalQuestions);
      setResponse('');
    } catch (err) {
      setError('Failed to load question: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const submitResponse = async () => {
    if (!response.trim()) {
      setError('Please provide a response before continuing.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      
      await ApiService.recordTranscript(sessionId, response, questionIndex);
      await loadNextQuestion();
    } catch (err) {
      setError('Failed to submit response: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };



  if (isLoading) {
    return (
      <div className="interview-session loading">
        <div className="spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="interview-session">
      <div className="progress-bar">
        <div className="progress-text">
          Question {questionIndex + 1} of {totalQuestions}
        </div>
        <div className="progress-fill" style={{ width: `${((questionIndex + 1) / totalQuestions) * 100}%` }}></div>
      </div>

      <div className="question-section">
        <h2>Interview Question</h2>
        <p className="question-text">{currentQuestion}</p>
      </div>

      <div className="response-section">
        <h3>Your Response</h3>
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Type your response here... (aim for 1-2 minutes worth of content)"
          rows={8}

        />
        
        <div className="recording-controls">
          <button
            onClick={submitResponse}
            className="submit-btn"
            disabled={isLoading || !response.trim()}
          >
            Submit Response
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};

export default InterviewSession;