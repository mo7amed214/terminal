Modeling Purdue Level 3 for an Industrial Honeypot
Bachelor thesis · Feb - Jun 2026 · German University in Cairo
Supervised by Dr. Amr Mohamed Saber

A high-interaction honeypot of the operations layer of a
discrete-manufacturing plant, built as one layer of a seven-person
project. I built the engineering workstation, a process historian,
and an OPC UA server in C (open62541) driven by a simulator in which
tags affect each other, so the plant behaves like a plant instead of
a random-number generator. Then I attacked it.

  attack chain    8 steps, validated end to end
  detection       26 custom Wazuh rules, Zeek scripts, Sysmon
  process         15 live tags served over OPC UA
  session model   94.7% danger-level accuracy on 660 held-out examples

- A quieter variant of the last step writes plausible values instead
  of obvious spikes.
- Deception surfaces were picked from MITRE ATT&CK for ICS. A decoy
  OPC UA endpoint planted in the documentation measurably slowed down
  an autonomous LLM agent attacking the environment.
- Grafana dashboards for OT telemetry and SOC triage, and a
  bidirectional LSTM with attention that classifies attacker sessions
  by danger level, attack path and intent.

stack: python c/open62541 asyncua docker wazuh zeek sysmon grafana

Replay the attack:  ./attack-chain.sh
