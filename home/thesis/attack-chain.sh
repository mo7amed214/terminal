#!/bin/sh
# Replays the attack chain from the thesis, one step at a time.
step "credentials found in an anonymous SMB share"
step "SSH into the engineering workstation"
step "Nmap reconnaissance of the plant network"
step "SMB share browsed for project files"
step "process historian accessed"
step "OPC UA address space browsed"
step "ARP man-in-the-middle established"
impact "live tag values rewritten over OPC UA"
