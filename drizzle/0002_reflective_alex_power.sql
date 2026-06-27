CREATE TABLE `ticketNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`isInternal` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticketNotes_id` PRIMARY KEY(`id`)
);
