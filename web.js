var express = require("express");
var path = require("path");

var app = express();
var PORT = process.env.PORT || 8001;

app.use(express.static(path.join(__dirname, "dist")));

app.get("*", function(req, res) {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

app.listen(PORT, function() {
  console.log("Server running on port " + PORT);
});
