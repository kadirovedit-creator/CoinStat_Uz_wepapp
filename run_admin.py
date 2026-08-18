#!/usr/bin/env python3
"""Run Admin Panel: python run_admin.py"""
import os
import sys

# Ensure the project root is in the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from admin.main import main

if __name__ == "__main__":
    main()
