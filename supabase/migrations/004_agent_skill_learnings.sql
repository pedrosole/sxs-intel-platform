-- Agent skill learnings persistence
CREATE TABLE IF NOT EXISTS agent_skill_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_skill_learnings_agent_skill ON agent_skill_learnings(agent_id, skill_id);
