import React from "react";

const LandingPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <h1 className="text-3xl font-bold">Select Your Role</h1>
      <div className="flex gap-4">
        <button
          onClick={() =>
            (window.location.href =
              "http://localhost:5173/interview?role=candidate")
          }
          className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
        >
          Candidate
        </button>
        <button
          onClick={() =>
            (window.location.href =
              "http://localhost:5173/interview?role=interviewer")
          }
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Interviewer
        </button>
      </div>
    </div>
  );
};

export default LandingPage;
