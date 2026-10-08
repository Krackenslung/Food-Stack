CREATE DATABASE Hotels;
USE Hotels;

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

select * from Users



