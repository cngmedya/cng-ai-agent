const express = require("express");
const router = express.Router();
const crmController = require("../controllers/crmController");

router.get("/leads", crmController.listLeads);
router.get("/leads/:id", crmController.getLeadDetail);
router.post("/leads/:id/notes", crmController.addNote);
router.patch("/leads/:id/status", crmController.updateStatus);

module.exports = router;