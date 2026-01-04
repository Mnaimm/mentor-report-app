// scripts/lib/entity-resolver.js
// Entity resolution and FK lookup utilities

/**
 * Normalize string for matching (lowercase, trim, remove extra whitespace)
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
function normalizeString(str) {
  if (!str) return '';
  return str.toString().toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Resolve entrepreneur ID by name
 * @param {Object} supabase - Supabase client
 * @param {string} entrepreneurName - Entrepreneur name from sheet
 * @returns {Promise<{id: string|null, folder_id: string|null, error: string|null}>}
 */
async function resolveEntrepreneurId(supabase, entrepreneurName) {
  if (!entrepreneurName || !entrepreneurName.trim()) {
    return { id: null, folder_id: null, error: 'Missing entrepreneur name' };
  }

  const normalizedName = normalizeString(entrepreneurName);

  try {
    // Try exact match first (case-insensitive)
    const { data, error } = await supabase
      .from('entrepreneurs')
      .select('id, folder_id, name')
      .ilike('name', entrepreneurName.trim())
      .limit(1);

    if (error) {
      return { id: null, folder_id: null, error: error.message };
    }

    if (data && data.length > 0) {
      return { id: data[0].id, folder_id: data[0].folder_id, error: null };
    }

    // If no exact match, try partial match
    const { data: partialData, error: partialError } = await supabase
      .from('entrepreneurs')
      .select('id, folder_id, name')
      .or(`name.ilike.%${entrepreneurName.trim()}%`)
      .limit(1);

    if (partialError) {
      return { id: null, folder_id: null, error: partialError.message };
    }

    if (partialData && partialData.length > 0) {
      return { id: partialData[0].id, folder_id: partialData[0].folder_id, error: null };
    }

    return { id: null, folder_id: null, error: `Entrepreneur not found: ${entrepreneurName}` };
  } catch (err) {
    return { id: null, folder_id: null, error: err.message };
  }
}

/**
 * Resolve mentor ID by email
 * @param {Object} supabase - Supabase client
 * @param {string} mentorEmail - Mentor email from sheet
 * @returns {Promise<{id: string|null, error: string|null}>}
 */
async function resolveMentorId(supabase, mentorEmail) {
  if (!mentorEmail || !mentorEmail.trim()) {
    return { id: null, error: 'Missing mentor email' };
  }

  const normalizedEmail = normalizeString(mentorEmail);

  try {
    const { data, error } = await supabase
      .from('mentors')
      .select('id, email')
      .ilike('email', mentorEmail.trim())
      .limit(1);

    if (error) {
      return { id: null, error: error.message };
    }

    if (data && data.length > 0) {
      return { id: data[0].id, error: null };
    }

    return { id: null, error: `Mentor not found: ${mentorEmail}` };
  } catch (err) {
    return { id: null, error: err.message };
  }
}

/**
 * Create or get existing session
 * @param {Object} supabase - Supabase client
 * @param {Object} sessionData - Session data
 * @returns {Promise<{id: string|null, isNew: boolean, error: string|null}>}
 */
async function resolveSessionId(supabase, sessionData) {
  const { mentor_id, entrepreneur_id, program, session_number, session_date } = sessionData;

  if (!mentor_id || !entrepreneur_id || !program || !session_number) {
    return { id: null, isNew: false, error: 'Missing required session data' };
  }

  try {
    // Check if session already exists
    const { data: existing, error: selectError } = await supabase
      .from('sessions')
      .select('id')
      .eq('mentor_id', mentor_id)
      .eq('entrepreneur_id', entrepreneur_id)
      .eq('program', program)
      .eq('session_number', session_number)
      .maybeSingle();

    if (selectError) {
      return { id: null, isNew: false, error: selectError.message };
    }

    // If exists, return existing ID
    if (existing) {
      return { id: existing.id, isNew: false, error: null };
    }

    // Otherwise, create new session
    const newSession = {
      mentor_id,
      entrepreneur_id,
      program,
      session_number,
      session_date: session_date || null,
      status: 'completed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: created, error: insertError } = await supabase
      .from('sessions')
      .insert(newSession)
      .select('id')
      .single();

    if (insertError) {
      return { id: null, isNew: false, error: insertError.message };
    }

    return { id: created.id, isNew: true, error: null };

  } catch (err) {
    return { id: null, isNew: false, error: err.message };
  }
}

/**
 * Resolve all entities for a report row
 * @param {Object} supabase - Supabase client
 * @param {Array} row - Sheet row data
 * @param {number} sessionNumber - Parsed session number
 * @returns {Promise<{success: boolean, entities: Object, errors: Array}>}
 */
async function resolveAllEntities(supabase, row, sessionNumber, program) {
  const errors = [];
  const entities = {
    entrepreneur_id: null,
    mentor_id: null,
    session_id: null,
    folder_id: null
  };

  // Resolve entrepreneur
  const entrepreneurName = row[7]; // Column H
  const entrepreneurResult = await resolveEntrepreneurId(supabase, entrepreneurName);
  if (entrepreneurResult.error) {
    errors.push(`Entrepreneur: ${entrepreneurResult.error}`);
  } else {
    entities.entrepreneur_id = entrepreneurResult.id;
    entities.folder_id = entrepreneurResult.folder_id;
  }

  // Resolve mentor
  const mentorEmail = row[1]; // Column B
  const mentorResult = await resolveMentorId(supabase, mentorEmail);
  if (mentorResult.error) {
    errors.push(`Mentor: ${mentorResult.error}`);
  } else {
    entities.mentor_id = mentorResult.id;
  }

  // If both entrepreneur and mentor resolved, create/get session
  if (entities.entrepreneur_id && entities.mentor_id && sessionNumber) {
    const sessionData = {
      mentor_id: entities.mentor_id,
      entrepreneur_id: entities.entrepreneur_id,
      program,
      session_number: sessionNumber,
      session_date: row[4] || null // Column E
    };

    const sessionResult = await resolveSessionId(supabase, sessionData);
    if (sessionResult.error) {
      errors.push(`Session: ${sessionResult.error}`);
    } else {
      entities.session_id = sessionResult.id;
    }
  }

  const success = errors.length === 0 && entities.session_id !== null;
  return { success, entities, errors };
}

module.exports = {
  normalizeString,
  resolveEntrepreneurId,
  resolveMentorId,
  resolveSessionId,
  resolveAllEntities
};
