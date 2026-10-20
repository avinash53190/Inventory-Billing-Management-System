import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Scanner;
import java.util.concurrent.Executors;

public class InventoryServer {
    private static final Path WEB_ROOT = Path.of("web").toAbsolutePath().normalize();

    public static void main(String[] args) throws Exception {
        String password = readPassword();
        DatabaseConfig.configurePassword(password);
        DatabaseConfig.testConnection(password);
        if (args.length > 0 && args[0].equals("--test-db")) {
            return;
        }
        HttpServer server = HttpServer.create(new InetSocketAddress("localhost", 8080), 0);
        server.setExecutor(Executors.newCachedThreadPool());
        server.createContext("/api/", InventoryServer::handleApi);
        server.createContext("/", InventoryServer::serveWebFile);
        server.start();
        System.out.println("Inventory server running at http://localhost:8080");
    }

    private static String readPassword() {
        System.out.print("Enter MySQL root password: ");
        System.out.flush();
        Scanner scanner = new Scanner(System.in);
        return scanner.nextLine();
    }

    private static void handleApi(HttpExchange exchange) throws IOException {
        try {
            String[] parts = exchange.getRequestURI().getPath().substring("/api/".length()).split("/");
            String path = parts[0];
            String id = parts.length > 1 ? parts[1] : null;
            String method = exchange.getRequestMethod();
            if (method.equals("GET")) {
                sendJson(exchange, getData(path));
            } else if (method.equals("POST")) {
                Map<String, String> data = parseForm(readBody(exchange));
                sendJson(exchange, saveData(path, data));
            } else if (method.equals("PUT") && id != null) {
                Map<String, String> data = parseForm(readBody(exchange));
                sendJson(exchange, updateData(path, id, data));
            } else if (method.equals("DELETE") && id != null) {
                sendJson(exchange, deleteData(path, id));
            } else {
                sendJson(exchange, error("Method not allowed"), 405);
            }
        } catch (Exception exception) {
            exception.printStackTrace();
            sendJson(exchange, error(exception.getMessage()), 400);
        }
    }

    private static String getData(String path) throws SQLException {
        return switch (path) {
            case "dashboard" -> dashboard();
            case "products" -> products(false);
            case "low-stock" -> products(true);
            case "categories" -> simpleList("SELECT CategoryID id, CategoryName name FROM Category ORDER BY CategoryName");
            case "suppliers" -> suppliers();
            case "customers" -> customers();
            case "employees" -> employees();
            default -> error("Unknown endpoint");
        };
    }

    private static String saveData(String path, Map<String, String> data) throws SQLException {
        return switch (path) {
            case "products" -> addProduct(data);
            case "categories" -> insert("INSERT INTO Category (CategoryName) VALUES (?)", data.get("name"));
            case "suppliers" -> insert("INSERT INTO Supplier (SupplierName, Phone, Address) VALUES (?, ?, ?)", data.get("name"), data.get("phone"), data.get("address"));
            case "customers" -> insert("INSERT INTO Customer (FirstName, LastName, Phone, Email) VALUES (?, ?, ?, ?)", data.get("firstName"), data.get("lastName"), data.get("phone"), data.get("email"));
            case "employees" -> insert("INSERT INTO Employee (FirstName, LastName, Phone, Role) VALUES (?, ?, ?, ?)", data.get("firstName"), data.get("lastName"), data.get("phone"), data.get("role"));
            case "bills" -> createBill(data);
            default -> error("Unknown endpoint");
        };
    }

    private static String updateData(String path, String id, Map<String, String> data) throws SQLException {
        return switch (path) {
            case "products" -> update("UPDATE Product SET ProductName = ?, CategoryID = ?, SupplierID = ?, UnitPrice = ?, QuantityInStock = ?, ReorderLevel = ? WHERE ProductID = ?", data.get("name"), data.get("categoryId"), data.get("supplierId"), data.get("price"), data.get("stock"), data.get("reorderLevel"), id);
            case "categories" -> update("UPDATE Category SET CategoryName = ? WHERE CategoryID = ?", data.get("name"), id);
            case "suppliers" -> update("UPDATE Supplier SET SupplierName = ?, Phone = ?, Address = ? WHERE SupplierID = ?", data.get("name"), data.get("phone"), data.get("address"), id);
            case "customers" -> update("UPDATE Customer SET FirstName = ?, LastName = ?, Phone = ?, Email = ? WHERE CustomerID = ?", data.get("firstName"), data.get("lastName"), data.get("phone"), data.get("email"), id);
            case "employees" -> update("UPDATE Employee SET FirstName = ?, LastName = ?, Phone = ?, Role = ? WHERE EmployeeID = ?", data.get("firstName"), data.get("lastName"), data.get("phone"), data.get("role"), id);
            default -> error("Unknown endpoint");
        };
    }

    private static String deleteData(String path, String id) throws SQLException {
        String sql = switch (path) {
            case "products" -> "DELETE FROM Product WHERE ProductID = ?";
            case "categories" -> "DELETE FROM Category WHERE CategoryID = ?";
            case "suppliers" -> "DELETE FROM Supplier WHERE SupplierID = ?";
            case "customers" -> "DELETE FROM Customer WHERE CustomerID = ?";
            case "employees" -> "DELETE FROM Employee WHERE EmployeeID = ?";
            default -> throw new SQLException("Unknown endpoint");
        };
        return update(sql, id);
    }

    private static String dashboard() throws SQLException {
        try (Connection connection = DatabaseConfig.openConnection(); Statement statement = connection.createStatement();
             ResultSet result = statement.executeQuery("SELECT (SELECT COUNT(*) FROM Product) products, (SELECT COUNT(*) FROM Category) categories, (SELECT COUNT(*) FROM Customer) customers, (SELECT COUNT(*) FROM Supplier) suppliers, (SELECT COUNT(*) FROM Product WHERE QuantityInStock <= ReorderLevel) lowStock")) {
            result.next();
            return "{\"products\":" + result.getInt("products") + ",\"categories\":" + result.getInt("categories") + ",\"customers\":" + result.getInt("customers") + ",\"suppliers\":" + result.getInt("suppliers") + ",\"lowStock\":" + result.getInt("lowStock") + "}";
        }
    }

    private static String products(boolean lowStock) throws SQLException {
        String sql = "SELECT p.ProductID id, p.ProductName name, c.CategoryName category, s.SupplierName supplier, p.UnitPrice price, p.QuantityInStock stock, p.ReorderLevel reorderLevel FROM Product p LEFT JOIN Category c ON p.CategoryID = c.CategoryID LEFT JOIN Supplier s ON p.SupplierID = s.SupplierID" + (lowStock ? " WHERE p.QuantityInStock <= p.ReorderLevel" : "") + " ORDER BY p.ProductID";
        return queryObjects(sql, result -> "{\"id\":" + result.getInt("id") + ",\"name\":" + quote(result.getString("name")) + ",\"category\":" + quote(result.getString("category")) + ",\"supplier\":" + quote(result.getString("supplier")) + ",\"price\":" + result.getBigDecimal("price") + ",\"stock\":" + result.getInt("stock") + ",\"reorderLevel\":" + result.getInt("reorderLevel") + "}");
    }

    private static String suppliers() throws SQLException {
        return queryObjects("SELECT SupplierID id, SupplierName name, Phone phone, Address address FROM Supplier ORDER BY SupplierName", result -> "{\"id\":" + result.getInt("id") + ",\"name\":" + quote(result.getString("name")) + ",\"phone\":" + quote(result.getString("phone")) + ",\"address\":" + quote(result.getString("address")) + "}");
    }

    private static String customers() throws SQLException {
        return queryObjects("SELECT CustomerID id, FirstName firstName, LastName lastName, Phone phone, Email email FROM Customer ORDER BY FirstName, LastName", result -> "{\"id\":" + result.getInt("id") + ",\"firstName\":" + quote(result.getString("firstName")) + ",\"lastName\":" + quote(result.getString("lastName")) + ",\"phone\":" + quote(result.getString("phone")) + ",\"email\":" + quote(result.getString("email")) + "}");
    }

    private static String employees() throws SQLException {
        return queryObjects("SELECT EmployeeID id, FirstName firstName, LastName lastName, Phone phone, Role role FROM Employee ORDER BY FirstName, LastName", result -> "{\"id\":" + result.getInt("id") + ",\"firstName\":" + quote(result.getString("firstName")) + ",\"lastName\":" + quote(result.getString("lastName")) + ",\"phone\":" + quote(result.getString("phone")) + ",\"role\":" + quote(result.getString("role")) + "}");
    }

    private static String simpleList(String sql) throws SQLException {
        return queryObjects(sql, result -> "{\"id\":" + result.getInt("id") + ",\"name\":" + quote(result.getString("name")) + "}");
    }

    @FunctionalInterface
    private interface RowFormatter { String format(ResultSet result) throws SQLException; }

    private static String queryObjects(String sql, RowFormatter formatter) throws SQLException {
        List<String> rows = new ArrayList<>();
        try (Connection connection = DatabaseConfig.openConnection(); PreparedStatement statement = connection.prepareStatement(sql); ResultSet result = statement.executeQuery()) {
            while (result.next()) rows.add(formatter.format(result));
        }
        return "[" + String.join(",", rows) + "]";
    }

    private static String addProduct(Map<String, String> data) throws SQLException {
        return insert("INSERT INTO Product (ProductName, CategoryID, SupplierID, UnitPrice, QuantityInStock, ReorderLevel) VALUES (?, ?, ?, ?, ?, ?)", data.get("name"), data.get("categoryId"), data.get("supplierId"), data.get("price"), data.get("stock"), data.get("reorderLevel"));
    }

    private static String insert(String sql, String... values) throws SQLException {
        try (Connection connection = DatabaseConfig.openConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < values.length; i++) statement.setString(i + 1, values[i]);
            statement.executeUpdate();
        }
        return "{\"success\":true}";
    }

    private static String update(String sql, String... values) throws SQLException {
        try (Connection connection = DatabaseConfig.openConnection(); PreparedStatement statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < values.length; i++) statement.setString(i + 1, values[i]);
            statement.executeUpdate();
        }
        return "{\"success\":true}";
    }

    private static String createBill(Map<String, String> data) throws SQLException {
        int customerId = Integer.parseInt(data.get("customerId"));
        int employeeId = Integer.parseInt(data.get("employeeId"));
        String[] productValues = data.getOrDefault("productIds", data.get("productId")).split(",");
        String[] quantityValues = data.getOrDefault("quantities", data.get("quantity")).split(",");
        if (productValues.length == 0 || productValues.length != quantityValues.length) throw new SQLException("Bill items are invalid");
        List<Integer> productIds = new ArrayList<>();
        List<Integer> quantities = new ArrayList<>();
        for (int i = 0; i < productValues.length; i++) {
            int productId = Integer.parseInt(productValues[i]);
            int quantity = Integer.parseInt(quantityValues[i]);
            if (quantity <= 0) throw new SQLException("Quantity must be positive");
            productIds.add(productId);
            quantities.add(quantity);
        }
        try (Connection connection = DatabaseConfig.openConnection()) {
            connection.setAutoCommit(false);
            try {
                List<BigDecimal> subtotals = new ArrayList<>();
                BigDecimal total = BigDecimal.ZERO;
                try (PreparedStatement product = connection.prepareStatement("SELECT UnitPrice, QuantityInStock FROM Product WHERE ProductID = ? FOR UPDATE")) {
                    for (int i = 0; i < productIds.size(); i++) {
                        product.setInt(1, productIds.get(i));
                        try (ResultSet result = product.executeQuery()) {
                            if (!result.next()) throw new SQLException("Product not found");
                            if (quantities.get(i) > result.getInt("QuantityInStock")) throw new SQLException("Quantity is greater than available stock");
                            BigDecimal subtotal = result.getBigDecimal("UnitPrice").multiply(BigDecimal.valueOf(quantities.get(i)));
                            subtotals.add(subtotal);
                            total = total.add(subtotal);
                        }
                    }
                }
                int billId;
                try (PreparedStatement bill = connection.prepareStatement("INSERT INTO Bill (CustomerID, EmployeeID, BillDate, TotalAmount) VALUES (?, ?, ?, ?)", Statement.RETURN_GENERATED_KEYS)) {
                    bill.setInt(1, customerId); bill.setInt(2, employeeId); bill.setDate(3, new Date(System.currentTimeMillis())); bill.setBigDecimal(4, total); bill.executeUpdate();
                    try (ResultSet keys = bill.getGeneratedKeys()) { if (!keys.next()) throw new SQLException("Bill ID was not generated"); billId = keys.getInt(1); }
                }
                try (PreparedStatement item = connection.prepareStatement("INSERT INTO BillItem (BillID, ProductID, Quantity, Subtotal) VALUES (?, ?, ?, ?)"); PreparedStatement update = connection.prepareStatement("UPDATE Product SET QuantityInStock = QuantityInStock - ? WHERE ProductID = ? AND QuantityInStock >= ?")) {
                    for (int i = 0; i < productIds.size(); i++) {
                        item.setInt(1, billId); item.setInt(2, productIds.get(i)); item.setInt(3, quantities.get(i)); item.setBigDecimal(4, subtotals.get(i)); item.executeUpdate();
                        update.setInt(1, quantities.get(i)); update.setInt(2, productIds.get(i)); update.setInt(3, quantities.get(i)); if (update.executeUpdate() != 1) throw new SQLException("Stock update failed");
                    }
                }
                connection.commit();
                return "{\"success\":true,\"billId\":" + billId + ",\"total\":" + total + "}";
            } catch (Exception exception) {
                connection.rollback();
                throw exception;
            } finally {
                connection.setAutoCommit(true);
            }
        }
    }

    private static void serveWebFile(HttpExchange exchange) throws IOException {
        String requested = exchange.getRequestURI().getPath();
        if (requested.equals("/")) requested = "/index.html";
        Path file = WEB_ROOT.resolve(requested.substring(1)).normalize();
        if (!file.startsWith(WEB_ROOT) || !Files.exists(file) || Files.isDirectory(file)) { sendText(exchange, "Not found", 404, "text/plain"); return; }
        String type = requested.endsWith(".css") ? "text/css" : requested.endsWith(".js") ? "application/javascript" : "text/html";
        sendText(exchange, Files.readString(file), 200, type);
    }

    private static String readBody(HttpExchange exchange) throws IOException { return new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8); }
    private static Map<String, String> parseForm(String body) { Map<String, String> values = new HashMap<>(); for (String part : body.split("&")) { String[] pair = part.split("=", 2); if (pair.length == 2) values.put(URLDecoder.decode(pair[0], StandardCharsets.UTF_8), URLDecoder.decode(pair[1], StandardCharsets.UTF_8)); } return values; }
    private static String quote(String value) { if (value == null) return "null"; return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\r", "\\r").replace("\n", "\\n") + "\""; }
    private static String error(String message) { return "{\"success\":false,\"error\":" + quote(message == null ? "Unknown error" : message) + "}"; }
    private static void sendJson(HttpExchange exchange, String json) throws IOException { sendText(exchange, json, 200, "application/json"); }
    private static void sendJson(HttpExchange exchange, String json, int status) throws IOException { sendText(exchange, json, status, "application/json"); }
    private static void sendText(HttpExchange exchange, String text, int status, String contentType) throws IOException { byte[] bytes = text.getBytes(StandardCharsets.UTF_8); exchange.getResponseHeaders().set("Content-Type", contentType + "; charset=utf-8"); exchange.sendResponseHeaders(status, bytes.length); try (OutputStream output = exchange.getResponseBody()) { output.write(bytes); } }
}