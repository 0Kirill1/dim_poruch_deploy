-- liquibase formatted sql
-- changeset kirill:01-create-notifications-table
-- comment: Create notification table

CREATE TABLE IF NOT EXISTS notifications(
    id UUID PRIMARY KEY,
    recipient_id UUID,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(150) NOT NULL,
    body VARCHAR(500) NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_recipient_id FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_type_notification ON notifications(recipient_id, type);