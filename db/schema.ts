import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);
export const vaultCategoryEnum = pgEnum("vault_category", [
  "bloodwork",
  "genetics",
  "wearables",
  "body-composition",
  "notes",
  "other",
]);
export const vaultStatusEnum = pgEnum("vault_status", [
  "ready",
  "processing",
  "failed",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("union_id", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  agentId: varchar("agent_id", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  agentId: varchar("agent_id", { length: 50 }),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const vaultFiles = pgTable("vault_files", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 64 }).notNull(),
  category: vaultCategoryEnum("category").default("other").notNull(),
  size: integer("size").notNull(),
  status: vaultStatusEnum("status").default("ready").notNull(),
  encryptedUrl: text("encrypted_url"),
  iv: varchar("iv", { length: 255 }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type VaultFile = typeof vaultFiles.$inferSelect;
