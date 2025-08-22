// server.js
require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const telnyxSdk = require("telnyx"); // for webhook signature verify only

const app = express();
app.use(cors());

// ---- Webhook route MUST get raw body for signature verification ----
app.post(
  "/webhooks/telnyx",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      console.log("webhook triggered");

      const raw = req.body; // Buffer

      const event = JSON.parse(raw.toString());
      console.log("Webhook:", event.data.event_type, event.data.payload);

      // Example: when call is answered, you could auto-speak and gather
      if (event.data.event_type === "call.answered") {
        const call_control_id = event.data.payload.call_control_id;
        // Speak then gather digits
        axios
          .post(
            `https://api.telnyx.com/v2/calls/${call_control_id}/actions/transfer`,
            {
              to: "sip:usersiddharthmot80788.sip.telnyx.com",
            },
            {
              headers: {
                Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
                "Content-Type": "application/json",
              },
            }
          )
          .catch((e) =>
            console.error(
              "gather_using_speak error",
              e?.response?.data || e.message
            )
          );
      }

      // Log DTMF press
      if (event.data.event_type === "call.dtmf.received") {
        const digits = event.data.payload.digit;
        console.log("DTMF received:", digits);
      }

      return res.status(200).send("ok");
    } catch (err) {
      console.error("Webhook verification failed:", err.message);
      return res.status(400).send("invalid signature");
    }
  }
);

// For all other JSON routes
app.use(express.json());

// Create an outbound call
app.post("/api/calls", async (req, res) => {
  try {
    const { to } = req.body;
    const resp = await axios.post(
      "https://api.telnyx.com/v2/calls",
      {
        to,
        from: process.env.TELNYX_FROM_NUMBER,
        connection_id: process.env.TELNYX_CONNECTION_ID,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    // Returns call_control_id and more
    res.json(resp.data);
  } catch (e) {
    console.error(e?.response?.data || e.message);
    res.status(500).json({ error: e?.response?.data || e.message });
  }
});

// Send DTMF to an in-progress call
app.post("/api/calls/:call_control_id/dtmf", async (req, res) => {
  try {
    const { digits } = req.body;
    const { call_control_id } = req.params;
    const resp = await axios.post(
      `https://api.telnyx.com/v2/calls/${call_control_id}/actions/send_dtmf`,
      { digits },
      {
        headers: {
          Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    res.json(resp.data);
  } catch (e) {
    console.error(e?.response?.data || e.message);
    res.status(500).json({ error: e?.response?.data || e.message });
  }
});

// Start/Stop recording
app.post("/api/calls/:call_control_id/record/start", async (req, res) => {
  try {
    const { call_control_id } = req.params;
    const resp = await axios.post(
      `https://api.telnyx.com/v2/calls/${call_control_id}/actions/record_start`,
      { format: "mp3", channels: "single" },
      { headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` } }
    );
    res.json(resp.data);
  } catch (e) {
    console.error(e?.response?.data || e.message);
    res.status(500).json({ error: e?.response?.data || e.message });
  }
});

app.post("/api/calls/:call_control_id/record/stop", async (req, res) => {
  try {
    const { call_control_id } = req.params;
    const resp = await axios.post(
      `https://api.telnyx.com/v2/calls/${call_control_id}/actions/record_stop`,
      {},
      { headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` } }
    );
    res.json(resp.data);
  } catch (e) {
    console.error(e?.response?.data || e.message);
    res.status(500).json({ error: e?.response?.data || e.message });
  }
});

// Hang up
app.post("/api/calls/:call_control_id/hangup", async (req, res) => {
  try {
    const { call_control_id } = req.params;
    const resp = await axios.post(
      `https://api.telnyx.com/v2/calls/${call_control_id}/actions/hangup`,
      {},
      { headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` } }
    );
    res.json(resp.data);
  } catch (e) {
    console.error(e?.response?.data || e.message);
    res.status(500).json({ error: e?.response?.data || e.message });
  }
});

app.listen(process.env.PORT || 4000, () =>
  console.log(`Server listening on ${process.env.PORT || 4000}`)
);
