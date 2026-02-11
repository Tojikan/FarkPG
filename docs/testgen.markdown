---
layout: default
title: Character Generator Test
permalink: /testgen/
scripts:
  - /assets/js/themes/basic.js
  - /assets/js/character-builder.js
custom_css: |
  /* Header Row - Title + Buttons */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid #1a1a1a;
  }
  .page-header h1 {
    font-size: 1.25rem;
    margin: 0;
  }
  .controls {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .controls button {
    padding: 0.4rem 0.75rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  #open-builder { background: #2ecc71; color: white; }
  #export-btn { background: #3498db; color: white; }
  #import-btn { background: #9b59b6; color: white; }
  #copy-btn { background: #e67e22; color: white; }
  #paste-btn { background: #e67e22; color: white; }
  #print-btn { background: #95a5a6; color: white; }
  #import-file { display: none; }

  /* Character Name + Health Row */
  .sheet-header-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    align-items: flex-end;
  }
  .name-section {
    flex: 1;
    min-width: 0;
  }
  .sheet-label {
    font-weight: bold;
    color: #666;
    font-size: 0.75rem;
    text-transform: uppercase;
    display: block;
    margin-bottom: 0.25rem;
  }
  .name-value {
    font-size: 1.5rem;
    font-weight: bold;
    padding: 0.25rem 0;
    border-bottom: 1px solid #ccc;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name-value.placeholder {
    color: #999;
    font-style: italic;
  }

  /* Health Box - Horizontal */
  .health-box {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    flex-shrink: 0;
  }
  .health-display {
    display: flex;
    align-items: baseline;
    gap: 0.25rem;
  }
  .health-current {
    font-size: 1.5rem;
    font-weight: bold;
    width: 80px;
    padding: 0.1rem 0.25rem;
    border: none;
    border-bottom: 1px solid transparent;
    background: transparent;
    text-align: right;
    transition: border-color 0.15s, background 0.15s;
    -moz-appearance: textfield;
  }
  .health-current::-webkit-outer-spin-button,
  .health-current::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .health-current:hover,
  .health-current:focus {
    background: #f5f5f5;
    border-bottom-color: #ccc;
    outline: none;
  }
  .health-sep {
    color: #999;
    font-size: 1rem;
  }
  .health-max {
    color: #888;
    font-size: 0.85rem;
  }
  .health-adjust {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  .health-add-input {
    width: 50px;
    padding: 0.2rem 0.3rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    text-align: center;
    font-size: 0.85rem;
  }
  .health-add-btn {
    padding: 0.2rem 0.5rem;
    border: none;
    border-radius: 4px;
    background: #3498db;
    color: white;
    cursor: pointer;
    font-size: 0.75rem;
  }
  .health-reset-btn {
    padding: 0.2rem 0.4rem;
    border: none;
    border-radius: 4px;
    background: #95a5a6;
    color: white;
    cursor: pointer;
    font-size: 0.8rem;
  }

  /* Main Layout - Attributes Left, Skills Right */
  .sheet-main {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }
  .attributes-bar {
    width: 120px;
    flex-shrink: 0;
    background: #f5f5f5;
    padding: 1rem;
    border-radius: 8px;
  }
  .attributes-bar h3 {
    font-size: 0.9rem;
    margin: 0 0 0.75rem 0;
    text-transform: uppercase;
    color: #666;
  }
  .attr-item {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid #ddd;
  }
  .attr-item:last-child {
    border-bottom: none;
  }
  .attr-label {
    font-size: 0.85rem;
  }
  .attr-value {
    font-weight: bold;
    font-size: 1rem;
  }

  /* Skills Section - Vertical Boxes */
  .skills-section {
    flex: 1;
  }
  .skills-section h3 {
    font-size: 0.9rem;
    margin: 0 0 0.75rem 0;
    text-transform: uppercase;
    color: #666;
  }
  .skills-columns {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  .skill-category-box {
    background: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 0.75rem;
  }
  .skill-category-box h4 {
    font-size: 0.85rem;
    margin: 0 0 0.5rem 0;
    color: #333;
    border-bottom: 1px solid #ddd;
    padding-bottom: 0.25rem;
  }
  .skills-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .skill-item {
    display: flex;
    justify-content: space-between;
    padding: 0.3rem 0.5rem;
    background: white;
    border-radius: 4px;
    font-size: 0.85rem;
  }
  .skill-label {
    color: #333;
  }
  .skill-attr {
    font-size: 0.7rem;
    color: #888;
    margin-left: 0.25rem;
  }
  .skill-value {
    font-weight: bold;
  }
  .skill-item[title] {
    cursor: help;
  }

  /* Abilities Section - Full Width with Cards */
  .abilities-section {
    border-top: 1px solid #eee;
    padding-top: 1rem;
  }
  .abilities-section h3 {
    font-size: 0.9rem;
    margin: 0 0 0.75rem 0;
    text-transform: uppercase;
    color: #666;
  }
  .abilities-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .ability-card {
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 0.75rem 1rem;
  }
  .ability-card.custom {
    background: #f3e8f8;
    border-color: #d4b8e0;
  }
  .ability-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .ability-name {
    font-weight: bold;
    font-size: 1rem;
  }
  .ability-cost {
    font-size: 0.8rem;
    color: #666;
    background: #e0e0e0;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }
  .ability-desc {
    margin: 0;
    font-size: 0.85rem;
    color: #555;
    line-height: 1.4;
  }
  .empty {
    color: #999;
    font-style: italic;
    font-size: 0.85rem;
  }

  /* Builder Modal */
  .builder-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1000;
    overflow-y: auto;
    padding: 1rem;
  }
  .builder-modal.open {
    display: block;
  }
  .builder-container {
    background: white;
    max-width: 800px;
    margin: 0 auto;
    border-radius: 8px;
    padding: 1.5rem;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }
  .builder-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 1rem;
    border-bottom: 2px solid #1a1a1a;
    flex-shrink: 0;
  }
  .builder-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  #builder-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 0;
  }
  .builder-footer {
    padding-top: 1rem;
    border-top: 2px solid #1a1a1a;
    display: flex;
    justify-content: flex-end;
    flex-shrink: 0;
    background: white;
  }
  #close-builder {
    padding: 0.6rem 2rem;
    border: none;
    border-radius: 4px;
    background: #2ecc71;
    color: white;
    cursor: pointer;
    font-size: 1rem;
    font-weight: bold;
  }
  #close-builder:hover {
    background: #27ae60;
  }

  /* Builder Sections */
  .builder-section {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #eee;
  }
  .builder-section label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }
  .builder-section input[type="text"],
  .builder-section input[type="number"]:not(.points-input) {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
  }
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }
  .section-header h3 {
    margin: 0;
    font-size: 1rem;
  }
  .always-tag {
    font-size: 0.7rem;
    background: #2ecc71;
    color: white;
    padding: 0.15rem 0.4rem;
    border-radius: 3px;
    margin-left: 0.5rem;
    font-weight: normal;
  }
  .points-display {
    font-size: 0.85rem;
    color: #666;
  }
  .points-input {
    width: 50px;
    padding: 0.2rem;
    border: 1px dashed #ccc;
    border-radius: 4px;
    text-align: center;
    font-size: 0.8rem;
    margin-left: 0.5rem;
  }
  .item-range {
    color: #999;
    font-size: 0.75rem;
    margin-left: 0.25rem;
  }

  /* Builder Grid - 2 column layout with vertical lists */
  .builder-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
  .builder-grid-box {
    background: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 0.75rem;
  }
  .builder-grid-box h4 {
    font-size: 1rem;
    font-weight: bold;
    margin: 0;
    color: #333;
  }
  .skill-box-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid #ddd;
  }
  .points-display-small {
    font-size: 0.75rem;
    color: #666;
    display: flex;
    align-items: center;
  }
  .builder-section input[type="number"].points-input-inline {
    width: 2.5ch;
    padding: 0;
    border: none;
    border-bottom: 1px dashed #999;
    background: transparent;
    text-align: center;
    font-size: inherit;
    color: inherit;
    -moz-appearance: textfield;
    margin-top: 2px;
  }
  .builder-section input[type="number"].points-input-inline::-webkit-outer-spin-button,
  .builder-section input[type="number"].points-input-inline::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .builder-section input[type="number"].points-input-inline:focus {
    outline: none;
    border-bottom-color: #333;
  }
  
  /* Attributes single box with 2-col grid */
  .attributes-box {
    width: 100%;
  }
  .attributes-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.35rem;
    grid-column-gap: 1rem;    
  }
  .builder-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .builder-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.4rem 0.5rem;
    background: white;
    border-radius: 4px;
  }
  .builder-item.custom {
    background: #e8f4e8;
  }
  .builder-item .custom-label {
    width: 80px;
    padding: 0.2rem;
    font-size: 0.8rem;
  }
  .builder-item .skill-attr {
    font-size: 0.7rem;
    color: #888;
    margin-left: 0.25rem;
  }
  .builder-item[title] {
    cursor: help;
  }
  .item-controls {
    display: flex;
    align-items: center;
    gap: 0.2rem;
  }
  .item-controls button {
    width: 26px;
    height: 26px;
    border: none;
    border-radius: 4px;
    background: #1a1a1a;
    color: white;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .item-controls button:hover:not(:disabled) {
    background: #333;
  }
  .item-controls button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  .item-controls .item-value {
    min-width: 20px;
    text-align: center;
    font-weight: bold;
  }
  .remove-btn {
    background: #e74c3c !important;
    margin-left: 0.2rem;
  }

  /* Add Custom Buttons */
  .add-custom-btn {
    margin-top: 0.5rem;
    padding: 0.4rem 0.75rem;
    border: 2px dashed #ccc;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    color: #666;
    font-size: 0.85rem;
    width: 100%;
  }
  .add-custom-btn:hover {
    border-color: #999;
    color: #333;
  }

  /* Abilities Builder */
  .abilities-builder-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .ability-builder-card {
    background: #f5f5f5;
    border: 2px solid #ddd;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    transition: border-color 0.2s, background 0.2s;
  }
  .ability-builder-card.selected {
    border-color: #2ecc71;
    background: #e8f8ee;
  }
  .ability-builder-card.disabled {
    opacity: 0.5;
  }
  .ability-builder-card.custom {
    background: #f3e8f8;
    border-color: #9b59b6;
  }
  .ability-toggle {
    display: flex;
    gap: 0.75rem;
    cursor: pointer;
  }
  .ability-toggle input[type="checkbox"] {
    width: 20px;
    height: 20px;
    margin-top: 0.25rem;
    flex-shrink: 0;
  }
  .ability-info {
    flex: 1;
  }
  .ability-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .ability-builder-card .ability-name {
    font-weight: bold;
    font-size: 1rem;
  }
  .ability-builder-card .ability-cost {
    font-size: 0.8rem;
    color: #666;
    background: #e0e0e0;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }
  .ability-toggle.levelable {
    flex-direction: column;
    align-items: flex-start;
  }
  .ability-level-controls {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    margin-bottom: 0.5rem;
  }
  .ability-level-controls button {
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 3px;
    background: #1a1a1a;
    color: white;
    cursor: pointer;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ability-level-controls button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  .ability-level {
    min-width: 16px;
    text-align: center;
    font-weight: bold;
    font-size: 0.85rem;
  }
  .ability-toggle.levelable .ability-info {
    width: 100%;
  }
  .ability-builder-card .ability-desc {
    margin: 0;
    font-size: 0.85rem;
    color: #555;
    line-height: 1.4;
  }
  .custom-ability-edit {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .custom-ability-row {
    display: flex;
    gap: 0.5rem;
    align-items: flex-end;
    margin-bottom: 0.5rem;
  }
  .custom-field {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .custom-field-label {
    font-size: 0.7rem;
    color: #666;
    text-transform: uppercase;
  }
  .custom-field:first-child {
    flex: 1;
  }
  .custom-ability-name {
    padding: 0.4rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.95rem;
    font-weight: bold;
    width: 100%;
  }
  .custom-cost-input {
    width: 50px;
    padding: 0.4rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    text-align: center;
    font-size: 0.9rem;
  }
  .levelable-field {
    align-items: center;
  }
  .custom-levelable-check {
    width: 18px;
    height: 18px;
    margin: 0.3rem 0;
  }
  .custom-ability-row .remove-btn {
    align-self: flex-end;
    margin-bottom: 0.3rem;
  }
  .custom-level-controls {
    display: flex;
    align-items: center;
    gap: 0.15rem;
  }
  .custom-level-controls button {
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 3px;
    background: #1a1a1a;
    color: white;
    cursor: pointer;
    font-size: 0.75rem;
  }
  .custom-level-controls button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
  .custom-level-value {
    min-width: 18px;
    text-align: center;
    font-weight: bold;
  }
  .custom-ability-desc {
    width: 100%;
    min-height: 60px;
    padding: 0.4rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.85rem;
    resize: vertical;
  }

  /* Custom item edit mode */
  .custom-item-edit {
    background: #f8f8f8;
    border: 1px dashed #999;
    border-radius: 6px;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
  }
  .custom-item-edit.ability-edit {
    padding: 1rem;
  }
  .custom-edit-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .custom-edit-name {
    flex: 1;
    padding: 0.4rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.9rem;
  }
  .custom-attr-select {
    padding: 0.4rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.85rem;
    min-width: 60px;
  }
  .custom-edit-desc {
    width: 100%;
    min-height: 50px;
    padding: 0.4rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.85rem;
    resize: vertical;
    margin-bottom: 0.5rem;
  }
  .custom-edit-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }
  .custom-edit-actions .save-btn {
    background: #28a745;
    color: white;
    border: none;
    padding: 0.4rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .custom-edit-actions .save-btn:hover {
    background: #218838;
  }
  .custom-edit-actions .delete-btn {
    background: #dc3545;
    color: white;
    border: none;
    padding: 0.4rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }
  .custom-edit-actions .delete-btn:hover {
    background: #c82333;
  }

  /* Custom tag styling */
  .custom-tag {
    color: #28a745;
    font-size: 0.75rem;
    font-weight: normal;
    margin-left: 0.3rem;
    background: none;
  }

  /* Edit icon */
  .edit-icon {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    color: #666;
    padding: 0;
    margin-right: 0.3rem;
    line-height: 1;
  }
  .edit-icon:hover {
    color: #333;
  }

  /* Paste Modal */
  .paste-modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1001;
    padding: 1rem;
  }
  .paste-modal.open {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .paste-container {
    background: white;
    width: 100%;
    max-width: 500px;
    border-radius: 8px;
    padding: 1.5rem;
  }
  .paste-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  .paste-header h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  #close-paste {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
    padding: 0;
    line-height: 1;
  }
  #close-paste:hover {
    color: #333;
  }
  .paste-content {
    margin-bottom: 1rem;
  }
  #paste-input {
    width: 100%;
    height: 200px;
    padding: 0.75rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.85rem;
    resize: vertical;
  }
  #paste-input:focus {
    outline: none;
    border-color: #3498db;
  }
  .paste-error {
    color: #e74c3c;
    font-size: 0.85rem;
    margin-top: 0.5rem;
    min-height: 1.2em;
  }
  .paste-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .paste-cancel-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
  }
  .paste-cancel-btn:hover {
    background: #f5f5f5;
  }
  .paste-confirm-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    background: #2ecc71;
    color: white;
    cursor: pointer;
  }
  .paste-confirm-btn:hover {
    background: #27ae60;
  }

  /* Print Styles */
  @media print {
    .page-header,
    .controls,
    .health-adjust,
    #builder-modal,
    .navbar {
      display: none !important;
    }
    .health-current {
      cursor: default;
    }
    .health-current:hover {
      background: none;
    }
    body {
      background: white;
    }
    .content {
      box-shadow: none;
      padding: 0;
      margin: 0;
    }
  }

  /* Mobile */
  @media (max-width: 600px) {
    .page-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .controls {
      width: 100%;
    }
    .controls button {
      flex: 1;
    }
    .sheet-header-row {
      flex-direction: column;
      align-items: stretch;
    }
    .name-section {
      width: 100%;
      text-align: left;
    }
    .health-box {
      width: 100%;
      align-items: center;
      margin-top: 0.5rem;
    }
    .health-display {
      justify-content: center;
    }
    .health-adjust {
      justify-content: center;
    }
    .sheet-main {
      flex-direction: column;
    }
    .attributes-bar {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
    }
    .attributes-bar h3 {
      grid-column: 1 / -1;
    }
    .attr-item {
      flex-direction: column;
      text-align: center;
      border-bottom: none;
      background: white;
      padding: 0.5rem;
      border-radius: 4px;
    }
    .skills-columns {
      grid-template-columns: 1fr;
    }
    .builder-grid {
      grid-template-columns: 1fr;
    }
    .attributes-grid {
      grid-template-columns: 1fr;
    }
    .skill-box-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
    .custom-edit-row {
      flex-direction: column;
      align-items: stretch;
    }
    .custom-ability-row {
      flex-direction: column;
      align-items: stretch;
    }
  }
---

<div class="page-header no-print">
  <h1>Character Sheet</h1>
  <div class="controls">
    <button id="open-builder">Builder</button>
    <button id="export-btn">Export</button>
    <button id="import-btn">Import</button>
    <button id="copy-btn">Copy JSON</button>
    <button id="paste-btn">Paste JSON</button>
    <button id="print-btn">Print</button>
    <input type="file" id="import-file" accept=".json">
  </div>
</div>

<div id="character-sheet">
  <p>Loading...</p>
</div>

<div id="builder-modal" class="builder-modal">
  <div class="builder-container">
    <div class="builder-header">
      <h2>Character Builder</h2>
    </div>
    <div id="builder-content"></div>
    <div class="builder-footer">
      <button id="close-builder">Done</button>
    </div>
  </div>
</div>

<div id="paste-modal" class="paste-modal">
  <div class="paste-container">
    <div class="paste-header">
      <h2>Paste JSON</h2>
      <button id="close-paste">&times;</button>
    </div>
    <div class="paste-content">
      <textarea id="paste-input" placeholder="Paste your character JSON here..."></textarea>
      <div id="paste-error" class="paste-error"></div>
    </div>
    <div class="paste-footer">
      <button id="paste-cancel" class="paste-cancel-btn">Cancel</button>
      <button id="paste-confirm" class="paste-confirm-btn">Load Character</button>
    </div>
  </div>
</div>
