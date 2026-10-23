// src/views/ExamCreator.jsx
// Form interface for authoring and editing MCQ examinations.

import React, { useState, useEffect } from "react";

export default function ExamCreator({ editingExamId, onFinished, onCancel }) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [questions, setQuestions] = useState([
    {
      id: "q-1",
      text: "",
      options: ["", "", "", ""],
      correctAnswer: 0,
      explanation: ""
    }
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Load existing exam details if editing
  useEffect(() => {
    if (editingExamId) {
      loadExamDetails(editingExamId);
    }
  }, [editingExamId]);

  async function loadExamDetails(id) {
    setIsLoading(true);
    setError("");
    try {
      const exam = await window.examTrace.getExamForEditing(id);
      setTitle(exam.title || "");
      setSubject(exam.subject || "");
      setDescription(exam.description || "");
      setDurationMinutes(exam.durationMinutes || 15);
      if (exam.questions && exam.questions.length > 0) {
        setQuestions(exam.questions);
      }
    } catch (err) {
      setError(err.message || "Failed to load examination for editing.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleAddQuestion() {
    setQuestions([
      ...questions,
      {
        id: `q-${Date.now()}`,
        text: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
        explanation: ""
      }
    ]);
  }

  function handleRemoveQuestion(index) {
    if (questions.length <= 1) {
      setError("An examination must contain at least one question.");
      return;
    }
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
  }

  function handleQuestionTextChange(index, text) {
    const updated = [...questions];
    updated[index].text = text;
    setQuestions(updated);
  }

  function handleOptionChange(qIndex, optIndex, value) {
    const updated = [...questions];
    const newOptions = [...updated[qIndex].options];
    newOptions[optIndex] = value;
    updated[qIndex].options = newOptions;
    setQuestions(updated);
  }

  function handleCorrectAnswerChange(qIndex, optIndex) {
    const updated = [...questions];
    updated[qIndex].correctAnswer = optIndex;
    setQuestions(updated);
  }

  function handleExplanationChange(index, explanation) {
    const updated = [...questions];
    updated[index].explanation = explanation;
    setQuestions(updated);
  }

  async function handleSaveExam(e) {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    // Basic frontend checks
    if (!title.trim()) {
      setError("Please provide an examination title.");
      return;
    }

    if (!durationMinutes || Number(durationMinutes) <= 0) {
      setError("Please specify a valid duration in minutes.");
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) {
        setError(`Question ${i + 1} is missing question text.`);
        return;
      }
      for (let j = 0; j < 4; j++) {
        if (!q.options[j].trim()) {
          setError(`Question ${i + 1}, Option ${j + 1} is empty.`);
          return;
        }
      }
    }

    setIsLoading(true);

    const payload = {
      id: editingExamId || undefined,
      title: title.trim(),
      subject: subject.trim() || "General",
      description: description.trim(),
      durationMinutes: Number(durationMinutes),
      questions
    };

    try {
      const res = await window.examTrace.saveExam(payload);
      if (res && res.success) {
        setSuccessMsg("Examination saved successfully!");
        setTimeout(() => {
          onFinished();
        }, 1200);
      }
    } catch (err) {
      setError(err.message || "Failed to save examination.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="view-container">
      <div className="view-header">
        <div>
          <h2>{editingExamId ? "Edit Examination" : "Create New Examination"}</h2>
          <p className="subtitle">Configure exam parameters and multiple-choice questions.</p>
        </div>
        <button className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>
          Cancel
        </button>
      </div>

      {error && <div className="error-alert" style={{ marginBottom: "16px" }}>{error}</div>}
      {successMsg && <div className="success-alert" style={{ marginBottom: "16px" }}>{successMsg}</div>}

      <form onSubmit={handleSaveExam} className="exam-form">
        {/* Exam Overview Section */}
        <div className="card form-card">
          <h3 className="form-card-title">General Information</h3>

          <div className="form-row">
            <div className="form-group flex-2">
              <label>Examination Title *</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g., Database Systems Mid-Term"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="form-group flex-1">
              <label>Subject / Course</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g., Computer Science"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="form-group flex-1">
              <label>Duration (Minutes) *</label>
              <input
                type="number"
                min="1"
                max="300"
                className="input-field"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: "14px" }}>
            <label>Description (Optional Instructions)</label>
            <textarea
              className="textarea-field"
              rows="2"
              placeholder="e.g., Answer all questions. Negative marking does not apply."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Questions Section */}
        <div className="questions-header" style={{ marginTop: "24px" }}>
          <h3>Questions ({questions.length})</h3>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleAddQuestion}
            disabled={isLoading}
          >
            + Add Another Question
          </button>
        </div>

        <div className="questions-list">
          {questions.map((q, qIndex) => (
            <div key={q.id || qIndex} className="card question-card">
              <div className="question-card-header">
                <span className="question-number">Question {qIndex + 1}</span>
                {questions.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-danger-subtle btn-sm"
                    onClick={() => handleRemoveQuestion(qIndex)}
                    disabled={isLoading}
                  >
                    Delete Question
                  </button>
                )}
              </div>

              <div className="form-group" style={{ marginTop: "12px" }}>
                <label>Question Text *</label>
                <textarea
                  className="textarea-field"
                  rows="2"
                  placeholder={`Enter question ${qIndex + 1} statement...`}
                  value={q.text}
                  onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                  disabled={isLoading}
                />
              </div>

              {/* Options */}
              <div className="options-container">
                <label className="options-label">
                  Options (Select the radio button beside the correct answer) *
                </label>

                {q.options.map((opt, optIndex) => (
                  <div key={optIndex} className="option-row">
                    <input
                      type="radio"
                      name={`correct-${qIndex}`}
                      className="radio-input"
                      checked={q.correctAnswer === optIndex}
                      onChange={() => handleCorrectAnswerChange(qIndex, optIndex)}
                      disabled={isLoading}
                    />
                    <span className="option-badge">Option {optIndex + 1}</span>
                    <input
                      type="text"
                      className="input-field option-input"
                      placeholder={`Enter text for option ${optIndex + 1}`}
                      value={opt}
                      onChange={(e) => handleOptionChange(qIndex, optIndex, e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                ))}
              </div>

              {/* Optional Explanation */}
              <div className="form-group" style={{ marginTop: "14px" }}>
                <label>Explanation for Result Screen (Optional)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Explain why the selected option is correct..."
                  value={q.explanation || ""}
                  onChange={(e) => handleExplanationChange(qIndex, e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="form-actions-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleAddQuestion}
            disabled={isLoading}
          >
            + Add Question
          </button>

          <div style={{ display: "flex", gap: "12px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Save Examination"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
