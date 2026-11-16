-- liquibase formatted sql
-- changeset kirill:01-create-reviews-table
-- comment: Create review table

CREATE TABLE IF NOT EXISTS reviews(
    id UUID PRIMARY KEY,
    booking_id UUID,
    author_id UUID,
    rating SMALLINT NOT NULL,
    comment TEXT,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_id FOREIGN KEY (booking_id) REFERENCES booking(id) ON DELETE CASCADE,
    CONSTRAINT fk_author_id FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_booking_id ON reviews(booking_id, rating, status);