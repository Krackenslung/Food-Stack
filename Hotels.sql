-- Schema source of truth for the Hotels database.
-- Batches are separated by GO so the file runs both in SSMS and via
-- sqlcmd -i (CREATE DATABASE and USE must each be their own batch):
--   sqlcmd -S localhost\SQLEXPRESS -E -C -b -i Hotels.sql

CREATE DATABASE Hotels;
GO

USE Hotels;
GO

CREATE TABLE Users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(100),
    lastname VARCHAR(100),
    dateOfBirth DATE,
    username VARCHAR(50),
    password VARCHAR(255),
    phone VARCHAR(20),
    status BIT
);
GO

CREATE TABLE Locations (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name VARCHAR(100),
    description VARCHAR(255),
    address VARCHAR(255),
    lat FLOAT NOT NULL,
    lng FLOAT NOT NULL,
    userID INT,
    status BIT,
    FOREIGN KEY (userID) REFERENCES Users(id)
);
GO

CREATE TABLE Favorites (
    id INT IDENTITY(1,1) PRIMARY KEY,
    userID INT NOT NULL,
    placeID VARCHAR(255) NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (userID) REFERENCES Users(id),
    CONSTRAINT UQ_Favorites_user_place UNIQUE (userID, placeID)
);
GO

select * from Users
GO
