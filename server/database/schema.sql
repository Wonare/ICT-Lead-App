-- =====================================================================
-- ICT Lead Form - MySQL Schema
-- Creates the `leads`, `courses` and `admin_users` tables.
-- Safe to run multiple times (IF NOT EXISTS).
-- =====================================================================

CREATE TABLE IF NOT EXISTS leads (
  id                   INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  full_name            VARCHAR(120)     NOT NULL,
  phone                VARCHAR(20)      NOT NULL,
  email                VARCHAR(190)     NOT NULL,
  course               VARCHAR(120)     NOT NULL,
  learning_mode        ENUM('Physical','Online')                                  NOT NULL,
  communication_method ENUM('WhatsApp','Phone Call','Email','SMS')                NOT NULL,
  referral_source      ENUM('Facebook','Instagram','Google','Friend or Family','WhatsApp','Other') NOT NULL,
  referral_other       VARCHAR(150)     DEFAULT NULL,
  status               ENUM('New','Contacted','Enrolled','Not Interested','Closed') NOT NULL DEFAULT 'New',
  notes                TEXT             DEFAULT NULL,
  created_at           TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_leads_status  (status),
  KEY idx_leads_course  (course),
  KEY idx_leads_created (created_at),
  KEY idx_leads_email   (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courses (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  course_name VARCHAR(120)  NOT NULL,
  description VARCHAR(500)  DEFAULT NULL,
  status      ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_courses_name (course_name),
  KEY idx_courses_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(60)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(120) DEFAULT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
