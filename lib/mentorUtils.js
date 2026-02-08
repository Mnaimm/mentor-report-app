/**
 * Validates sequential session completion for a mentee.
 * 
 * Rules:
 * 1. Current Round R expects Session R.
 * 2. All previous sessions (1..R-1) must exist.
 * 3. Status priority:
 *    - MIA: Any session marked MIA.
 *    - On Track: Session R exists AND 1..R-1 exist.
 *    - Sequence Broken: Session R exists BUT gap in 1..R-1.
 *    - Never Started: Round >= 2 AND Session 1 missing.
 *    - Overdue/Due Soon/Pending: Session R missing (check dates).
 * 
 * @param {Array} sessions - Array of session objects { calculatedSessionNumber, status, programType }
 * @param {Number} currentRoundNumber - The expected session number for the current date
 * @param {Date} roundDueDate - The due date for the current round
 * @returns {Object} { status, expectedSession, submittedSessions, missingSessions, nextDueSession }
 */
export function validateSequentialSessions(sessions, currentRoundNumber, roundDueDate) {
    // 1. Extract submitted session numbers (chronological unique)
    // Filter for valid completed sessions
    const completedSessions = sessions.filter(s => {
        const status = (s.status || '').toLowerCase();
        if (s.programType === 'maju') {
            return status !== 'mia' && status.includes('tidak'); // "Tidak MIA"
        } else {
            return status === 'selesai' || status === 'completed';
        }
    });

    const submittedNumbers = [...new Set(completedSessions.map(s => s.calculatedSessionNumber))].sort((a, b) => a - b);

    // 2. Check for MIA in ANY session (history)
    const hasMIA = sessions.some(s => (s.status || '').toUpperCase() === 'MIA');
    if (hasMIA) {
        return {
            status: 'mia',
            expectedSession: currentRoundNumber,
            submittedSessions: submittedNumbers,
            missingSessions: [],
            completedCount: submittedNumbers.length
        };
    }

    // 3. Identify missing sessions up to Current Round
    // We check 1..currentRoundNumber
    const missingSessions = [];
    for (let i = 1; i < currentRoundNumber; i++) {
        if (!submittedNumbers.includes(i)) {
            missingSessions.push(i);
        }
    }

    const currentSessionExists = submittedNumbers.includes(currentRoundNumber);

    // 4. Determine Status
    let status = 'pending';

    if (currentSessionExists) {
        // Current session is done. Check history.
        if (missingSessions.length === 0) {
            status = 'on_track';
        } else {
            status = 'sequence_broken'; // Current done, but previous missing
        }
    } else {
        // Current session NOT done.
        if (currentRoundNumber >= 2 && !submittedNumbers.includes(1)) {
            // If we are in Round 2+ and Session 1 is missing -> Never Started
            status = 'never_started';
        } else if (missingSessions.length > 0) {
            // Missing some previous sessions -> Sequence Broken
            status = 'sequence_broken';
        } else {
            // All previous done, just waiting for current
            // Check due date for Overdue/Due Soon
            if (roundDueDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const due = new Date(roundDueDate);
                due.setHours(0, 0, 0, 0);

                const diffTime = due - today;
                const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (daysUntilDue < 0) {
                    status = 'overdue';
                } else if (daysUntilDue <= 7) {
                    status = 'due_soon';
                } else {
                    status = 'pending'; // Waiting, but plenty of time
                }
            } else {
                status = 'pending';
            }
        }
    }

    // Next Due Session is the first missing session, or the next one if all up to date
    let nextDueSession = currentRoundNumber;
    if (missingSessions.length > 0) {
        nextDueSession = missingSessions[0];
    } else if (currentSessionExists) {
        nextDueSession = currentRoundNumber + 1;
    }

    return {
        status,
        expectedSession: currentRoundNumber,
        submittedSessions: submittedNumbers,
        missingSessions,
        nextDueSession,
        completedCount: submittedNumbers.length
    };
}
