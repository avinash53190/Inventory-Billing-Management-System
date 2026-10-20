CREATE DATABASE IF NOT EXISTS inventory_db;
USE inventory_db;

CREATE TABLE Category (
    CategoryID INT PRIMARY KEY AUTO_INCREMENT,
    CategoryName VARCHAR(50) NOT NULL
);

CREATE TABLE Supplier (
    SupplierID INT PRIMARY KEY AUTO_INCREMENT,
    SupplierName VARCHAR(100) NOT NULL,
    Phone VARCHAR(15),
    Address VARCHAR(200)
);

CREATE TABLE Employee (
    EmployeeID INT PRIMARY KEY AUTO_INCREMENT,
    FirstName VARCHAR(50),
    LastName VARCHAR(50),
    Phone VARCHAR(15),
    Role VARCHAR(20)
);

CREATE TABLE Customer (
    CustomerID INT PRIMARY KEY AUTO_INCREMENT,
    FirstName VARCHAR(50),
    LastName VARCHAR(50),
    Phone VARCHAR(15) UNIQUE,
    Email VARCHAR(100)
);

CREATE TABLE Product (
    ProductID INT PRIMARY KEY AUTO_INCREMENT,
    ProductName VARCHAR(100) NOT NULL,
    CategoryID INT,
    SupplierID INT,
    UnitPrice DECIMAL(10, 2),
    QuantityInStock INT CHECK (QuantityInStock >= 0),
    ReorderLevel INT,
    CONSTRAINT fk_product_category
        FOREIGN KEY (CategoryID) REFERENCES Category(CategoryID),
    CONSTRAINT fk_product_supplier
        FOREIGN KEY (SupplierID) REFERENCES Supplier(SupplierID)
);

CREATE TABLE Bill (
    BillID INT PRIMARY KEY AUTO_INCREMENT,
    CustomerID INT, 
    EmployeeID INT,
    BillDate DATE,
    TotalAmount DECIMAL(10, 2),
    CONSTRAINT fk_bill_customer
        FOREIGN KEY (CustomerID) REFERENCES Customer(CustomerID),
    CONSTRAINT fk_bill_employee
        FOREIGN KEY (EmployeeID) REFERENCES Employee(EmployeeID)
);

CREATE TABLE BillItem (
    BillItemID INT PRIMARY KEY AUTO_INCREMENT,
    BillID INT,
    ProductID INT,
    Quantity INT CHECK (Quantity > 0),
    Subtotal DECIMAL(10, 2),
    CONSTRAINT fk_bill_item_bill
        FOREIGN KEY (BillID) REFERENCES Bill(BillID),
    CONSTRAINT fk_bill_item_product
        FOREIGN KEY (ProductID) REFERENCES Product(ProductID)
);

INSERT INTO Category (CategoryName) VALUES
    ('Electronics'),
    ('Accessories'),
    ('Grocery');

INSERT INTO Supplier (SupplierName, Phone, Address) VALUES
    ('ABC Suppliers', '9876543210', 'Delhi'),
    ('XYZ Traders', '9876501234', 'Mumbai');

INSERT INTO Employee (FirstName, LastName, Phone, Role) VALUES
    ('Avinash', 'Kumar', '9876511111', 'Cashier'),
    ('Rahul', 'Singh', '9876522222', 'Manager');

INSERT INTO Customer (FirstName, LastName, Phone, Email) VALUES
    ('Rahul', 'Kumar', '9876533333', 'rahul@example.com'),
    ('Amit', 'Sharma', '9876544444', 'amit@example.com');

INSERT INTO Product
    (ProductName, CategoryID, SupplierID, UnitPrice, QuantityInStock, ReorderLevel)
VALUES
    ('Wireless Mouse', 1, 1, 650.00, 20, 5),
    ('Keyboard', 1, 1, 900.00, 30, 5),
    ('USB Cable', 2, 2, 250.00, 50, 10);

INSERT INTO Bill (CustomerID, EmployeeID, BillDate, TotalAmount)
VALUES (1, 1, CURRENT_DATE, 1300.00);

INSERT INTO BillItem (BillID, ProductID, Quantity, Subtotal) VALUES
    (1, 1, 2, 1300.00);

UPDATE Product
SET QuantityInStock = QuantityInStock - 2
WHERE ProductID = 1;