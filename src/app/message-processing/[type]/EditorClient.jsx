"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import Papa from 'papaparse';

export default function MessageEditorClient({ type }) {
  const router = useRouter();
  const [credentials, setCredentials] = useState(null);
  const [value, setValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [validation, setValidation] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const editorRef = useRef(null);
  const [theme, setTheme] = useState('vs'); // 'vs' | 'vs-dark'
  const [wrap, setWrap] = useState(true);
  const [fontSize, setFontSize] = useState(14);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [editorHeight, setEditorHeight] = useState(600);
  const [toasts, setToasts] = useState([]); // {id, type, message}
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGuides, setShowGuides] = useState(false);
  const [inlineStatus, setInlineStatus] = useState(true);
  const [splitView, setSplitView] = useState(false);
  const [csvErrors, setCsvErrors] = useState([]);
  const [hl7Info, setHl7Info] = useState(null); // {segmentsCount, messageType, version, segments: [{name, fields}]}
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dataSourceIdentifier, setDataSourceIdentifier] = useState('LAB2'); // Default value
  const [isContentFolded, setIsContentFolded] = useState(false);

  useEffect(() => {
    const storedCredentials = sessionStorage.getItem('apiCredentials');
    if (storedCredentials) {
      setCredentials(JSON.parse(storedCredentials));
    } else {
      router.push('/register');
    }
  }, [router]);

  // Load persisted preferences and content
  useEffect(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem('editorPrefs') || '{}');
      if (prefs) {
        if (typeof prefs.theme === 'string') setTheme(prefs.theme);
        if (typeof prefs.wrap === 'boolean') setWrap(prefs.wrap);
        if (typeof prefs.fontSize === 'number') setFontSize(prefs.fontSize);
        if (typeof prefs.editorHeight === 'number') setEditorHeight(prefs.editorHeight);
        if (typeof prefs.showGuides === 'boolean') setShowGuides(prefs.showGuides);
        if (typeof prefs.inlineStatus === 'boolean') setInlineStatus(prefs.inlineStatus);
        if (typeof prefs.splitView === 'boolean') setSplitView(prefs.splitView);
      }
      const saved = localStorage.getItem(`editorContent:${normalizedType}`);
      if (!value && saved) {
        setValue(saved);
        notify('success', 'Restored previous content.', { inline: false, toast: true });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist preferences
  useEffect(() => {
    const prefs = {
      theme, wrap, fontSize, editorHeight, showGuides, inlineStatus, splitView
    };
    try { localStorage.setItem('editorPrefs', JSON.stringify(prefs)); } catch {}
  }, [theme, wrap, fontSize, editorHeight, showGuides, inlineStatus, splitView]);

  // (moved) Keyboard shortcuts are registered after action functions are defined

  const normalizedType = (type || '').toLowerCase();

  // Autosave content (debounced)
  useEffect(() => {
    const id = setTimeout(() => {
      try { localStorage.setItem(`editorContent:${normalizedType}`, value); } catch {}
    }, 400);
    return () => clearTimeout(id);
  }, [value, normalizedType]);

  const placeholder = useMemo(() => {
    if (normalizedType === 'cda') return '<ClinicalDocument>\n  <!-- XML here -->\n</ClinicalDocument>';
    if (normalizedType === 'hl7') return 'MSH|^~\\&|...';
    return '{\n  "example": true\n}';
  }, [normalizedType]);

  const languageLabel = useMemo(() => {
    if (normalizedType === 'cda') return 'XML';
    if (normalizedType === 'hl7') return 'CSV / HL7';
    return 'JSON';
  }, [normalizedType]);

  // Notify helper: configurable inline status and/or toast
  const notify = (type, message, opts) => {
    const options = opts || {};
    const inline = options.inline !== undefined ? options.inline : true;
    const toast = options.toast !== undefined ? options.toast : true;
    
    if (inline) setValidation({ type, message });
    if (toast) {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => {
        // Prevent duplicate messages by checking if the same message already exists
        const isDuplicate = prev.some(t => t.message === message && t.type === type);
        if (isDuplicate) return prev;
        return [...prev, { id, type, message }];
      });
      // auto-dismiss
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2500);
    }
  };

  // Advanced XML Pretty-Print formatter (similar to Notepad++ XML Tools)
  const formatXml = (xml) => {
    if (!xml || typeof xml !== 'string') return xml || '';
    
    // Remove all existing whitespace between tags but preserve content whitespace
    let formatted = xml.trim();
    
    // Handle CDATA sections - preserve them as-is
    const cdataRegex = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
    const cdataPlaceholders = [];
    formatted = formatted.replace(cdataRegex, (match, content) => {
      const placeholder = `__CDATA_PLACEHOLDER_${cdataPlaceholders.length}__`;
      cdataPlaceholders.push(match);
      return placeholder;
    });
    
    // Handle comments - preserve them
    const commentRegex = /<!--([\s\S]*?)-->/g;
    const commentPlaceholders = [];
    formatted = formatted.replace(commentRegex, (match, content) => {
      const placeholder = `__COMMENT_PLACEHOLDER_${commentPlaceholders.length}__`;
      commentPlaceholders.push(match);
      return placeholder;
    });
    
    // Remove whitespace between tags
    formatted = formatted.replace(/>\s+</g, '><');
    
    // Split into tokens
    const tokens = [];
    let current = '';
    let inTag = false;
    let inQuote = false;
    let quoteChar = '';
    
    for (let i = 0; i < formatted.length; i++) {
      const char = formatted[i];
      const nextChar = formatted[i + 1];
      
      if (!inTag && char === '<') {
        if (current.trim()) {
          tokens.push({ type: 'text', content: current.trim() });
        }
        current = char;
        inTag = true;
      } else if (inTag && char === '>' && !inQuote) {
        current += char;
        tokens.push({ type: 'tag', content: current });
        current = '';
        inTag = false;
      } else if (inTag && (char === '"' || char === "'")) {
        if (!inQuote) {
          inQuote = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuote = false;
          quoteChar = '';
        }
        current += char;
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      tokens.push({ type: inTag ? 'tag' : 'text', content: current.trim() });
    }
    
    // Format tokens with proper indentation
    let indentLevel = 0;
    const indentStr = '  '; // 2 spaces per indent level
    const result = [];
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const nextToken = tokens[i + 1];
      
      if (token.type === 'tag') {
        const content = token.content;
        
        // XML declaration or processing instruction
        if (content.startsWith('<?')) {
          result.push(content);
          if (nextToken && nextToken.type === 'tag') {
            result.push('\n');
          }
        }
        // Comment placeholder
        else if (content.includes('__COMMENT_PLACEHOLDER_')) {
          result.push(indentStr.repeat(indentLevel) + content);
          if (nextToken) result.push('\n');
        }
        // Self-closing tag
        else if (content.endsWith('/>')) {
          result.push(indentStr.repeat(indentLevel) + content);
          if (nextToken) result.push('\n');
        }
        // Closing tag
        else if (content.startsWith('</')) {
          indentLevel = Math.max(0, indentLevel - 1);
          result.push(indentStr.repeat(indentLevel) + content);
          if (nextToken) result.push('\n');
        }
        // Opening tag
        else if (content.startsWith('<')) {
          result.push(indentStr.repeat(indentLevel) + content);
          indentLevel++;
          
          // Check if next token is text content or closing tag
          if (nextToken) {
            if (nextToken.type === 'text') {
              // Inline text content
              result.push(nextToken.content);
              // Skip the text token in next iteration
              i++;
              // Check if there's a closing tag after text
              const afterText = tokens[i + 1];
              if (afterText && afterText.type === 'tag' && afterText.content.startsWith('</')) {
                result.push(afterText.content);
                indentLevel = Math.max(0, indentLevel - 1);
                i++; // Skip the closing tag in next iteration
              }
              if (tokens[i + 1]) result.push('\n');
            } else {
              result.push('\n');
            }
          }
        }
      }
    }
    
    // Restore CDATA sections
    let finalResult = result.join('');
    cdataPlaceholders.forEach((cdata, index) => {
      finalResult = finalResult.replace(`__CDATA_PLACEHOLDER_${index}__`, cdata);
    });
    
    // Restore comments
    commentPlaceholders.forEach((comment, index) => {
      finalResult = finalResult.replace(`__COMMENT_PLACEHOLDER_${index}__`, comment);
    });
    
    return finalResult.trim();
  };

  const beautify = () => {
    try {
      if (normalizedType === 'json') {
        const obj = JSON.parse(value);
        setValue(JSON.stringify(obj, null, 2));
        notify('success', 'Beautified JSON.', { inline: inlineStatus, toast: true });
      } else if (normalizedType === 'cda') {
        const formatted = formatXml(value);
        setValue(formatted);
        notify('success', 'Beautified XML.', { inline: inlineStatus, toast: true });
      } else {
        // For HL7/CSV treat as text: normalize line breaks and trim trailing spaces
        const out = (value || '').replace(/\r?\n/g, '\n').replace(/[\t ]+$/gm, '').trim();
        setValue(out);
        notify('success', 'Beautified text.', { inline: inlineStatus, toast: true });
      }
    } catch (e) {
      notify('error', e?.message || 'Beautify failed.', { inline: inlineStatus, toast: true });
    }
  };

  const minify = () => {
    try {
      if (normalizedType === 'json') {
        const obj = JSON.parse(value);
        setValue(JSON.stringify(obj));
        notify('success', 'Minified JSON.', { inline: inlineStatus, toast: true });
      } else if (normalizedType === 'cda') {
        const compact = (value || '').replace(/>\s+</g, '><').trim();
        setValue(compact);
        notify('success', 'Minified XML.', { inline: inlineStatus, toast: true });
      } else {
        setValue((value || '').replace(/\s+/g, ' ').trim());
        notify('success', 'Minified text.', { inline: inlineStatus, toast: true });
      }
    } catch (e) {
      notify('error', e?.message || 'Minify failed.', { inline: inlineStatus, toast: true });
    }
  };

  const jsonEscape = () => {
    try {
      const escaped = (value || '')
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\u0008/g, "\\b")  // Only escape actual backspace character, not \b in regex
        .replace(/\u000c/g, "\\f")  // Only escape actual form feed character, not \f in regex
        .replace(/\n/g, "\\r\\n")   // Convert \n to \r\n for Windows-style line endings
        .replace(/\r(?!\n)/g, "\\r") // Escape standalone \r that's not followed by \n
        .replace(/\t/g, "\\t")
        .replace(/\//g, "\\/");     // Escape forward slashes
      setValue(escaped);
      notify('success', 'Content JSON escaped.', { inline: inlineStatus, toast: true });
    } catch (e) {
      notify('error', e?.message || 'JSON escape failed.', { inline: inlineStatus, toast: true });
    }
  };

  const jsonUnescape = () => {
    try {
      const unescaped = (value || '')
        .replace(/\\"/g, '"')       // Unescape double quotes
        .replace(/\\\\/g, "\\")     // Unescape backslashes (must be done after other unescaping)
        .replace(/\\b/g, "\u0008")  // Unescape backspace
        .replace(/\\f/g, "\u000c")  // Unescape form feed
        .replace(/\\r\\n/g, "\n")   // Convert \r\n back to \n
        .replace(/\\r/g, "\r")      // Unescape standalone carriage returns
        .replace(/\\n/g, "\n")      // Unescape newlines
        .replace(/\\t/g, "\t")      // Unescape tabs
        .replace(/\\\//g, "/");     // Unescape forward slashes
      setValue(unescaped);
      notify('success', 'Content JSON unescaped.', { inline: inlineStatus, toast: true });
    } catch (e) {
      notify('error', e?.message || 'JSON unescape failed.', { inline: inlineStatus, toast: true });
    }
  };

  const validate = () => {
    try {
      if (normalizedType === 'json') {
        JSON.parse(value);
        notify('success', 'Valid JSON.', { inline: inlineStatus, toast: true });
      } else if (normalizedType === 'cda') {
        const parser = new DOMParser();
        const doc = parser.parseFromString(value, 'application/xml');
        const err = doc.getElementsByTagName('parsererror')[0];
        if (err) throw new Error('Invalid XML');
        notify('success', 'XML appears well-formed.', { inline: inlineStatus, toast: true });
      } else if (normalizedType === 'hl7') {
        const text = value || '';
        const looksLikeHl7 = /(^|\n|\r)MSH\|/.test(text);
        if (looksLikeHl7) {
          // Very basic HL7 sanity checks
          const segments = text.split(/\r?\n/).filter(Boolean);
          const hasMSH = segments[0]?.startsWith('MSH|');
          const fieldSep = hasMSH ? segments[0].charAt(3) : '|';
          const okSeparators = fieldSep === '|' || fieldSep === '^';
          if (!hasMSH || !okSeparators) throw new Error('HL7 does not appear valid. Missing/invalid MSH segment.');
          // Extract basic info
          const mshFields = segments[0].split('|');
          const msgType = mshFields[8] || '';
          const version = mshFields[11] || mshFields[12] || '';
          const parsedSegments = segments.slice(0, 100).map(s => ({ name: s.split('|')[0], fields: s.split('|').length }));
          setHl7Info({ segmentsCount: segments.length, messageType: msgType, version, segments: parsedSegments });
          setCsvErrors([]);
          notify('success', `HL7 detected with ${segments.length} segment(s).`, { inline: inlineStatus, toast: true });
          setCsvPreview(null);
        } else {
          // Treat as CSV
          const res = Papa.parse(text, { header: true, skipEmptyLines: true, delimiter: '' });
          if (res.errors && res.errors.length) {
            setCsvErrors(res.errors.slice(0, 10));
            notify('error', `CSV errors: ${res.errors[0]?.message || 'Parsing failed'}`, { inline: inlineStatus, toast: true });
            setCsvPreview(null);
            setHl7Info(null);
          } else {
            setCsvPreview(res.data.slice(0, 50));
            setCsvErrors([]);
            setHl7Info(null);
            notify('success', `CSV parsed. ${res.data.length} rows.`, { inline: inlineStatus, toast: true });
          }
        }
      }
    } catch (e) {
      notify('error', e?.message || 'Validation failed.', { inline: inlineStatus, toast: true });
    }
  };

  const formatDoc = async () => {
    if (!editorRef.current) return;
    const action = editorRef.current.getAction('editor.action.formatDocument');
    if (action) {
      try {
        await action.run();
        notify('success', 'Formatted with Monaco formatter.', { inline: inlineStatus, toast: true });
      } catch (e) {
        beautify();
        notify('success', 'Formatter failed. Applied Beautify instead.', { inline: inlineStatus, toast: true });
      }
    } else {
      // Fallback to beautify
      beautify();
      notify('success', 'No formatter available. Applied Beautify.', { inline: inlineStatus, toast: true });
    }
  };

  const onMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // cursor status
    editor.onDidChangeCursorPosition((e) => {
      const pos = e.position;
      setCursor({ line: pos.lineNumber, column: pos.column });
    });
    
    // Add Alt+0 keyboard shortcut directly to Monaco Editor (Notepad++ style Fold All)
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.Digit0, () => {
      console.log('Alt+0 (Fold All) triggered - Notepad++ style');
      
      try {
        // Multiple approaches to ensure folding works
        const model = editor.getModel();
        const language = model?.getLanguageId();
        
        console.log('Current language:', language);
        
        // Method 1: Try standard Monaco actions
        if (!isContentFolded) {
          console.log('Attempting to fold all...');
          
          // Try different fold action variations
          const foldActions = [
            'editor.foldAll',
            'editor.fold',
            'editor.foldAllMarkerRegions',
            'editor.foldAllBlockComments'
          ];
          
          let actionExecuted = false;
          for (const actionId of foldActions) {
            const action = editor.getAction(actionId);
            if (action) {
              console.log(`Executing action: ${actionId}`);
              action.run();
              actionExecuted = true;
              break;
            }
          }
          
          if (actionExecuted) {
            setIsContentFolded(true);
            notify('success', 'Folded all regions', { inline: false, toast: true });
          } else {
            // Method 2: Manual folding using Monaco's folding provider
            console.log('No standard actions available, trying manual folding...');
            
            // For XML content, manually fold based on indentation
            if (language === 'xml' || normalizedType === 'cda') {
              const lineCount = model.getLineCount();
              const foldingRanges = [];
              
              // Simple indentation-based folding for XML
              for (let i = 1; i <= lineCount; i++) {
                const line = model.getLineContent(i);
                const trimmed = line.trim();
                
                // Look for opening XML tags that aren't self-closing
                if (trimmed.match(/^<[^!?\/][^>]*[^\/]>/) && !trimmed.includes('</')) {
                  // Find the closing tag
                  const tagMatch = trimmed.match(/^<([^\\s>]+)/);
                  if (tagMatch) {
                    const tagName = tagMatch[1];
                    const closingTag = `</${tagName}>`;
                    
                    // Look for the closing tag
                    for (let j = i + 1; j <= lineCount; j++) {
                      const closeLine = model.getLineContent(j);
                      if (closeLine.includes(closingTag)) {
                        if (j > i + 1) { // Only fold if there's content between
                          foldingRanges.push({
                            startLineNumber: i,
                            endLineNumber: j,
                            startColumn: 1,
                            endColumn: model.getLineMaxColumn(j)
                          });
                        }
                        break;
                      }
                    }
                  }
                }
              }
              
              // Apply folding ranges
              if (foldingRanges.length > 0) {
                console.log(`Found ${foldingRanges.length} foldable regions`);
                
                // Use Monaco's folding API
                const foldingController = editor.getContribution('editor.contrib.folding');
                if (foldingController && foldingController.setFoldingRanges) {
                  foldingController.setFoldingRanges(foldingRanges);
                  setIsContentFolded(true);
                  notify('success', `Folded ${foldingRanges.length} XML regions`, { inline: false, toast: true });
                } else {
                  notify('info', 'Manual folding not supported in this Monaco version', { inline: false, toast: true });
                }
              } else {
                notify('info', 'No foldable XML regions found', { inline: false, toast: true });
              }
            } else {
              notify('error', 'Folding not supported for this content type', { inline: false, toast: true });
            }
          }
          
        } else {
          // Unfold all
          console.log('Attempting to unfold all...');
          
          const unfoldActions = [
            'editor.unfoldAll',
            'editor.unfold'
          ];
          
          let actionExecuted = false;
          for (const actionId of unfoldActions) {
            const action = editor.getAction(actionId);
            if (action) {
              console.log(`Executing action: ${actionId}`);
              action.run();
              actionExecuted = true;
              break;
            }
          }
          
          if (actionExecuted) {
            setIsContentFolded(false);
            notify('success', 'Unfolded all regions', { inline: false, toast: true });
          } else {
            // Manual unfold fallback
            setIsContentFolded(false);
            notify('success', 'Reset folding state', { inline: false, toast: true });
          }
        }
        
      } catch (error) {
        console.error('Alt+0 folding error:', error);
        notify('error', 'Folding operation failed: ' + error.message, { inline: false, toast: true });
      }
    });
  };

  const toggleWrap = () => {
    setWrap((w) => {
      const next = !w;
      notify('success', `Word wrap ${next ? 'enabled' : 'disabled'}.`, { inline: false, toast: true });
      return next;
    });
  };
  const toggleTheme = () => {
    setTheme((t) => {
      const next = t === 'vs' ? 'vs-dark' : 'vs';
      notify('success', `Theme set to ${next === 'vs' ? 'Light' : 'Dark'}.`, { inline: false, toast: true });
      return next;
    });
  };
  const incFont = () => {
    setFontSize((n) => {
      const next = Math.min(n + 1, 24);
      notify('success', `Font size: ${next}`, { inline: false, toast: true });
      return next;
    });
  };
  const decFont = () => {
    setFontSize((n) => {
      const next = Math.max(n - 1, 10);
      notify('success', `Font size: ${next}`, { inline: false, toast: true });
      return next;
    });
  };

  const toggleFullscreen = () => {
    setIsFullscreen((f) => {
      const next = !f;
      notify('success', next ? 'Entered fullscreen.' : 'Exited fullscreen.', { inline: false, toast: true });
      return next;
    });
  };

  const resetLayout = () => {
    setTheme('vs');
    setWrap(true);
    setFontSize(14);
    setEditorHeight(600);
    setShowGuides(false);
    notify('success', 'Layout reset to defaults.', { inline: false, toast: true });
  };

  const toggleGuides = () => {
    setShowGuides((g) => {
      const next = !g;
      notify('success', next ? 'Guides enabled.' : 'Guides disabled.', { inline: false, toast: true });
      return next;
    });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      notify('success', 'Copied to clipboard.', { inline: false, toast: true });
    } catch (e) {
      notify('error', e?.message || 'Copy failed.', { inline: false, toast: true });
    }
  };
  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setValue((v) => (v ? v + '\n' : '') + text);
      notify('success', 'Pasted from clipboard.', { inline: false, toast: true });
    } catch (e) {
      notify('error', e?.message || 'Paste failed.', { inline: false, toast: true });
    }
  };
  const clearEditor = () => {
    setValue('');
    notify('success', 'Editor cleared.', { inline: false, toast: true });
  };

  const downloadFile = () => {
    const blob = new Blob([value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ext = normalizedType === 'cda' ? 'xml' : normalizedType === 'json' ? 'json' : 'csv';
    a.href = url;
    a.download = `message.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    notify('success', 'Download started.', { inline: false, toast: true });
  };

  const fileInputRef = useRef(null);
  const triggerUpload = () => {
    fileInputRef.current?.click();
    notify('success', 'Choose a file to upload…', { inline: false, toast: true });
  };
  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setValue(String(reader.result || ''));
      notify('success', `Loaded file: ${file.name}`, { inline: false, toast: true });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const findReplace = () => {
    if (!editorRef.current) return;
    const action = editorRef.current.getAction('actions.find');
    if (action) {
      action.run();
      notify('success', 'Find/Replace opened.', { inline: false, toast: true });
    } else {
      notify('error', 'Find/Replace not available.', { inline: false, toast: true });
    }
  };

  const insertTemplate = () => {
    if (normalizedType === 'cda') setValue('<ClinicalDocument>\n  <recordTarget/>\n</ClinicalDocument>');
    else if (normalizedType === 'hl7') setValue('MSH|^~\\&|SND|FAC|RCV|FAC|202501010101||ADT^A01|MSG00001|P|2.5');
    else setValue(`{
  "transactionType": "EXAMPLE",
  "payload": {}
}`);
    notify('success', 'Template inserted.', { inline: false, toast: true });
  };

  // Initialize with placeholder when empty and when type changes
  useEffect(() => {
    if (!value) setValue(placeholder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeholder]);

  // Notepad++ style keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Prevent default browser shortcuts when our shortcuts are triggered
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      
      // Alt+0 - Collapse/Expand all content (similar to Notepad++)
      if (e.altKey && (e.key === '0' || e.code === 'Digit0')) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Alt+0 pressed - Key:', e.key, 'Code:', e.code); // Debug log
        
        if (editorRef.current) {
          try {
            // Try multiple approaches to folding
            const editor = editorRef.current;
            const model = editor.getModel();
            
            if (model) {
              console.log('Model available, line count:', model.getLineCount());
              
              // Method 1: Try Monaco's built-in actions
              const foldAction = editor.getAction('editor.foldAll');
              const unfoldAction = editor.getAction('editor.unfoldAll');
              
              console.log('Actions available:', { 
                foldAction: !!foldAction, 
                unfoldAction: !!unfoldAction,
                currentlyFolded: isContentFolded 
              });
              
              if (foldAction && unfoldAction) {
                if (!isContentFolded) {
                  console.log('Attempting to fold all...');
                  foldAction.run();
                  setIsContentFolded(true);
                  notify('success', 'Collapsed all foldable content.', { inline: false, toast: true });
                } else {
                  console.log('Attempting to unfold all...');
                  unfoldAction.run();
                  setIsContentFolded(false);
                  notify('success', 'Expanded all content.', { inline: false, toast: true });
                }
              } else {
                // Method 2: Try direct folding controller access
                console.log('Trying direct folding controller...');
                const foldingController = editor.getContribution('editor.contrib.folding');
                if (foldingController) {
                  if (!isContentFolded) {
                    // Try to fold all ranges
                    const ranges = foldingController.getFoldingModel()?.getRegions();
                    if (ranges && ranges.length > 0) {
                      console.log('Found folding ranges:', ranges.length);
                      foldingController.foldAll();
                      setIsContentFolded(true);
                      notify('success', 'Collapsed content using folding controller.', { inline: false, toast: true });
                    } else {
                      notify('info', 'No foldable regions found in this content.', { inline: false, toast: true });
                    }
                  } else {
                    foldingController.unfoldAll();
                    setIsContentFolded(false);
                    notify('success', 'Expanded content using folding controller.', { inline: false, toast: true });
                  }
                } else {
                  notify('error', 'Folding not supported. Try with XML/JSON content with nested structures.', { inline: false, toast: true });
                }
              }
            } else {
              notify('error', 'Editor model not available.', { inline: false, toast: true });
            }
          } catch (error) {
            console.error('Folding error:', error);
            notify('error', 'Folding failed: ' + error.message, { inline: false, toast: true });
          }
        } else {
          notify('error', 'Editor not ready.', { inline: false, toast: true });
        }
        return;
      }
      
      // Alt+1 - Toggle fullscreen (Notepad++ F11 equivalent)
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      
      // Alt+2 - Toggle word wrap (Notepad++ View menu)
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        toggleWrap();
        return;
      }
      
      // Alt+3 - Toggle theme (Notepad++ style switching)
      if (e.altKey && e.key === '3') {
        e.preventDefault();
        toggleTheme();
        return;
      }
      
      // Ctrl/Cmd + B - Beautify (Notepad++ XML Tools)
      if (isCtrlOrCmd && e.key === 'b') {
        e.preventDefault();
        beautify();
        return;
      }
      
      // Ctrl/Cmd + M - Minify
      if (isCtrlOrCmd && e.key === 'm') {
        e.preventDefault();
        minify();
        return;
      }
      
      // Ctrl/Cmd + Shift + F - Format Document
      if (isCtrlOrCmd && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        formatDoc();
        return;
      }
      
      // Ctrl/Cmd + E - Validate
      if (isCtrlOrCmd && e.key === 'e') {
        e.preventDefault();
        validate();
        return;
      }
      
      // Ctrl/Cmd + K - Clear editor
      if (isCtrlOrCmd && e.key === 'k') {
        e.preventDefault();
        clearEditor();
        return;
      }
      
      // Ctrl/Cmd + S - Download file (override browser save)
      if (isCtrlOrCmd && e.key === 's') {
        e.preventDefault();
        downloadFile();
        return;
      }
      
      // Ctrl/Cmd + O - Upload file (Notepad++ open)
      if (isCtrlOrCmd && e.key === 'o') {
        e.preventDefault();
        triggerUpload();
        return;
      }
      
      // Ctrl/Cmd + H - Find/Replace (Notepad++ find)
      if (isCtrlOrCmd && e.key === 'h') {
        e.preventDefault();
        findReplace();
        return;
      }
      
      // Ctrl/Cmd + T - Insert template
      if (isCtrlOrCmd && e.key === 't') {
        e.preventDefault();
        insertTemplate();
        return;
      }
      
      // Ctrl/Cmd + U - JSON Unescape
      if (isCtrlOrCmd && e.key === 'u') {
        e.preventDefault();
        jsonUnescape();
        return;
      }
      
      // Ctrl/Cmd + Shift + U - JSON Escape
      if (isCtrlOrCmd && e.shiftKey && e.key === 'U') {
        e.preventDefault();
        jsonEscape();
        return;
      }
      
      // Ctrl/Cmd + D - Duplicate line (common in Notepad++)
      if (isCtrlOrCmd && e.key === 'd') {
        e.preventDefault();
        if (editorRef.current) {
          const action = editorRef.current.getAction('editor.action.copyLinesDownAction');
          if (action) action.run();
        }
        return;
      }
      
      // Ctrl/Cmd + L - Delete line (Notepad++ Ctrl+L)
      if (isCtrlOrCmd && e.key === 'l') {
        e.preventDefault();
        if (editorRef.current) {
          const action = editorRef.current.getAction('editor.action.deleteLines');
          if (action) action.run();
        }
        return;
      }
      
      // F3 - Find next (Notepad++ style)
      if (e.key === 'F3') {
        e.preventDefault();
        if (editorRef.current) {
          const action = editorRef.current.getAction('editor.action.nextMatchFindAction');
          if (action) action.run();
        }
        return;
      }
      
      // Shift + F3 - Find previous
      if (e.shiftKey && e.key === 'F3') {
        e.preventDefault();
        if (editorRef.current) {
          const action = editorRef.current.getAction('editor.action.previousMatchFindAction');
          if (action) action.run();
        }
        return;
      }
      
      // F11 - Toggle fullscreen (Notepad++ standard)
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }
      
      // Esc - Close modals or exit fullscreen
      if (e.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
        if (isFullscreen) {
          setIsFullscreen(false);
          return;
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editorHeight, showShortcuts, isFullscreen, inlineStatus, isContentFolded]);

  const handleDataSourceChange = (e) => {
    setDataSourceIdentifier(e.target.value);
    // Clear validation error when user starts typing
    if (validation && validation.type === 'error') {
      setValidation(null);
    }
  };

  const handleProcess = async () => {
    if (!credentials) return;
    
    // Clear previous validation messages
    setValidation(null);
    
    // Validate dataSourceIdentifier for HL7 and CDA
    if (normalizedType !== 'json' && (!dataSourceIdentifier || dataSourceIdentifier.trim() === '')) {
      notify('error', 'Please add Data Source Identifier value.', { inline: true, toast: true });
      return;
    }
    
    setIsProcessing(true);
    setResult(null);
    // Clear validation messages when processing starts
    setValidation(null);
    try {
      const res = await fetch('/api/process-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: normalizedType,
          content: value,
          domain: credentials.domain,
          username: credentials.username,
          password: credentials.password,
          dataSourceIdentifier: dataSourceIdentifier.trim()
        })
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ success: false, error: e?.message || 'Request failed' });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!credentials) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-100 to-pink-50 flex items-center justify-center">
        <p className="text-lg text-purple-700 font-semibold animate-pulse">Loading credentials...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-100 to-pink-50 p-8">
      <div className={`${isFullscreen ? 'fixed inset-0 z-50 p-6 overflow-auto' : 'max-w-6xl mx-auto'} bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-purple-100 relative`}>
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => router.push('/create-patients')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-200 bg-white text-purple-800 font-semibold hover:bg-purple-50 transition"
          >
            ← Back
          </button>
          <div className="flex items-center gap-3">
            {normalizedType !== 'json' && (
              <div className="flex items-center gap-2">
                <label htmlFor="dataSourceId" className="text-sm font-medium text-purple-700">
                  Data Source ID:
                </label>
                <input
                  id="dataSourceId"
                  type="text"
                  value={dataSourceIdentifier}
                  onChange={handleDataSourceChange}
                  placeholder="e.g., LAB2"
                  className="px-3 py-1 border border-purple-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                />
              </div>
            )}
            <div className="px-4 py-2 rounded-lg border border-purple-200 bg-purple-50 text-purple-800 font-semibold">{languageLabel} Editor</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
          <button type="button" onClick={validate} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-sm font-semibold hover:bg-purple-200">Validate</button>
          <button type="button" onClick={beautify} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-sm font-semibold hover:bg-purple-200">Beautify</button>
          <button type="button" onClick={minify} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-sm font-semibold hover:bg-purple-200">Minify</button>
          <button type="button" onClick={jsonEscape} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-sm font-semibold hover:bg-purple-200">JSON Escape</button>
          <button type="button" onClick={jsonUnescape} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-sm font-semibold hover:bg-purple-200">JSON Unescape</button>
          <button type="button" onClick={formatDoc} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-sm font-semibold hover:bg-purple-200">Format</button>
          <span className="mx-2 h-6 w-px bg-purple-200" />
          <button type="button" onClick={toggleWrap} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold hover:bg-purple-200">Wrap: {wrap ? 'On' : 'Off'}</button>
          <button type="button" onClick={toggleTheme} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold hover:bg-purple-200">Theme: {theme === 'vs' ? 'Light' : 'Dark'}</button>
          <button type="button" onClick={toggleGuides} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold hover:bg-purple-200">Guides: {showGuides ? 'On' : 'Off'}</button>
          <button type="button" onClick={() => { setInlineStatus((v)=>!v); notify('success', `Inline status ${!inlineStatus ? 'enabled' : 'disabled'}.`, { inline: false, toast: true }); }} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold hover:bg-purple-200">Inline: {inlineStatus ? 'On' : 'Off'}</button>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-purple-700 font-medium">Font</span>
            <button type="button" onClick={decFont} className="px-2 py-0.5 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs hover:bg-purple-200">-</button>
            <span className="px-1 text-purple-800 text-xs">{fontSize}</span>
            <button type="button" onClick={incFont} className="px-2 py-0.5 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs hover:bg-purple-200">+</button>
          </div>
          <div className="flex items-center gap-1 text-sm ml-2">
            <span className="text-purple-700 font-medium">Height</span>
            <button type="button" onClick={() => setEditorHeight((h) => Math.max(h - 60, 300))} className="px-2 py-0.5 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs hover:bg-purple-200">-</button>
            <span className="px-1 text-purple-800 text-xs">{editorHeight}px</span>
            <button type="button" onClick={() => setEditorHeight((h) => Math.min(h + 60, 1200))} className="px-2 py-0.5 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs hover:bg-purple-200">+</button>
          </div>
          <button type="button" onClick={toggleFullscreen} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold hover:bg-purple-200">
            {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          </button>
          <button type="button" onClick={resetLayout} className="px-3 py-1 rounded bg-blue-100 border border-blue-200 text-blue-800 text-xs font-semibold hover:bg-blue-200">
            Reset Layout
          </button>
          <button type="button" onClick={() => setSplitView((v)=>!v)} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold hover:bg-purple-200">Split View: {splitView ? 'On' : 'Off'}</button>
          <button type="button" onClick={() => setShowShortcuts(true)} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold hover:bg-purple-200">Shortcuts</button>
          <span className="mx-2 h-6 w-px bg-purple-200" />
          <button type="button" onClick={copyToClipboard} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold hover:bg-purple-200">Copy</button>
          <button type="button" onClick={pasteFromClipboard} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold hover:bg-purple-200">Paste</button>
          <button type="button" onClick={clearEditor} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold hover:bg-purple-200">Clear</button>
          <button type="button" onClick={downloadFile} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold hover:bg-purple-200">Download</button>
          <button type="button" onClick={triggerUpload} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold hover:bg-purple-200">Upload</button>
          <input ref={fileInputRef} type="file" accept={normalizedType === 'cda' ? '.xml,.txt' : normalizedType === 'json' ? '.json,.txt' : '.csv,.txt'} className="hidden" onChange={onFileChange} />
          <span className="mx-2 h-6 w-px bg-purple-200" />
          <button type="button" onClick={findReplace} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold hover:bg-purple-200">Find/Replace</button>
          <button type="button" onClick={insertTemplate} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-xs font-semibold hover:bg-purple-200">Insert Template</button>
        </div>

        {/* Editor and optional Preview (split view) */}
        <div className={`${splitView ? 'grid grid-cols-1 lg:grid-cols-2 gap-3' : ''}`} style={{}}>
          <div
            className={`border rounded overflow-hidden relative ${isDragging ? 'ring-2 ring-pink-400' : ''}`}
            style={{ height: editorHeight }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault(); setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => { setValue(String(reader.result || '')); notify('success', `Loaded file: ${file.name}`, { inline: false, toast: true }); };
              reader.readAsText(file);
            }}
          >
            <Editor
              height="100%"
              defaultLanguage={normalizedType === 'cda' ? 'xml' : normalizedType === 'json' ? 'json' : 'plaintext'}
              language={normalizedType === 'cda' ? 'xml' : normalizedType === 'json' ? 'json' : 'plaintext'}
              value={value}
              onChange={(v) => setValue(v || '')}
              onMount={onMount}
              theme={theme}
              options={{
                minimap: { enabled: false },
                fontSize,
                wordWrap: wrap ? 'on' : 'off',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                renderWhitespace: 'selection',
                smoothScrolling: true,
                tabSize: 2,
                rulers: showGuides ? [80, 120] : [],
                cursorSmoothCaretAnimation: 'on',
                // Notepad++ style folding configuration
                folding: true,
                foldingStrategy: 'indentation', // Works better with XML/JSON structure
                foldingHighlight: true,
                foldingImportsByDefault: false,
                showFoldingControls: 'always',
                foldingMaximumRegions: 5000, // Handle large documents
                unfoldOnClickAfterEndOfLine: true // Notepad++ behavior
              }}
            />
            {isDragging && (
              <div className="absolute inset-0 bg-pink-50/70 flex items-center justify-center pointer-events-none text-pink-700 font-semibold">Drop file to load</div>
            )}
          </div>

          {splitView && (
            <div className="border rounded overflow-auto p-2 bg-white" style={{ height: editorHeight }}>
              <div className="text-sm font-semibold text-purple-800 mb-2">Preview</div>
              {normalizedType === 'json' && (
                <pre className="text-xs bg-purple-50 p-2 rounded overflow-auto text-purple-900">{(() => { try { return JSON.stringify(JSON.parse(value || '{}'), null, 2); } catch { return value; } })()}</pre>
              )}
              {normalizedType === 'cda' && (
                <pre className="text-xs bg-purple-50 p-2 rounded overflow-auto text-purple-900">{formatXml(value || '')}</pre>
              )}
              {normalizedType === 'hl7' && (
                <div className="space-y-2">
                  {csvPreview ? (
                    <div className="overflow-auto max-h-full border border-purple-100 rounded">
                      <table className="min-w-full text-xs">
                        <thead className="bg-purple-50 text-purple-800">
                          <tr>
                            {Object.keys(csvPreview[0] || {}).map((h) => (
                              <th key={h} className="px-2 py-1 text-left border-b border-purple-100">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.map((row, idx) => (
                            <tr key={idx} className={idx % 2 ? 'bg-white' : 'bg-purple-50/40'}>
                              {Object.keys(csvPreview[0] || {}).map((h) => (
                                <td key={h} className="px-2 py-1 border-b border-purple-50 text-purple-900">{String(row[h] ?? '')}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div>
                      {hl7Info ? (
                        <div className="text-xs">
                          <div className="mb-2 text-purple-800">Segments: {hl7Info.segmentsCount} | Type: {hl7Info.messageType} | Version: {hl7Info.version}</div>
                          <div className="overflow-auto max-h-full border border-purple-100 rounded">
                            <table className="min-w-full text-xs">
                              <thead className="bg-purple-50 text-purple-800">
                                <tr>
                                  <th className="px-2 py-1 text-left border-b border-purple-100">Segment</th>
                                  <th className="px-2 py-1 text-left border-b border-purple-100">Fields</th>
                                </tr>
                              </thead>
                              <tbody>
                                {hl7Info.segments.map((s, i) => (
                                  <tr key={i} className={i % 2 ? 'bg-white' : 'bg-purple-50/40'}>
                                    <td className="px-2 py-1 border-b border-purple-50 text-purple-900">{s.name}</td>
                                    <td className="px-2 py-1 border-b border-purple-50 text-purple-900">{s.fields}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">No preview available.</div>
                      )}
                    </div>
                  )}
                </div>
              )}
          </div>
          )}
        </div>

        <button
        type="button"
        onClick={handleProcess}
        disabled={isProcessing}
        className="w-full flex justify-center py-3 px-4 rounded-lg shadow-md text-base font-bold text-white bg-gradient-to-r from-blue-600 via-purple-600 to-pink-500 hover:from-pink-500 hover:to-blue-600 focus:outline-none focus:ring-4 focus:ring-pink-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isProcessing ? 'Processing...' : 'Process'}
      </button>

      {validation && (
        <div className={`mt-2 text-sm ${validation.type === 'success' ? 'text-green-600' : 'text-red-600'}`} aria-live="polite">
          {validation.message}
        </div>
      )}

          {/* CSV errors */}
          {csvErrors.length > 0 && (
            <div className="mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
              <div className="font-semibold mb-1">CSV Errors (showing up to 10)</div>
              <ul className="list-disc ml-5 space-y-0.5">
                {csvErrors.map((e, i) => (
                  <li key={i}><span className="font-mono">Row {e.row ?? '-'} Col {e.index ?? '-'}</span>: {e.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* HL7 info panel if not using preview */}
          {!splitView && hl7Info && (
            <div className="mt-2 text-xs bg-purple-50 border border-purple-200 rounded p-2 text-purple-900">
              <div className="font-semibold mb-1">HL7 Summary</div>
              <div>Segments: {hl7Info.segmentsCount} | Type: {hl7Info.messageType} | Version: {hl7Info.version}</div>
            </div>
          )}

          {csvPreview && normalizedType === 'hl7' && (
            <details className="mt-2">
              <summary className="text-sm text-gray-600 cursor-pointer">CSV Preview (first 50 rows)</summary>
              <div className="overflow-auto max-h-64 border border-purple-100 rounded">
                <table className="min-w-full text-xs">
                  <thead className="bg-purple-50 text-purple-800">
                    <tr>
                      {Object.keys(csvPreview[0] || {}).map((h) => (
                        <th key={h} className="px-2 py-1 text-left border-b border-purple-100">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.map((row, idx) => (
                      <tr key={idx} className={idx % 2 ? 'bg-white' : 'bg-purple-50/40'}>
                        {Object.keys(csvPreview[0] || {}).map((h) => (
                          <td key={h} className="px-2 py-1 border-b border-purple-50 text-purple-900">{String(row[h] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          {result && (
            <div className="mt-4 p-4 border border-purple-200 rounded bg-white">
              <div className="font-semibold mb-2">Response</div>
              {!result.success && (result.error?.includes('fetch failed') || result.details?.errorName === 'TypeError') && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  ⚠️ Connection Error: Unable to connect to the domain. Please check your environment URL.
                </div>
              )}
              <pre className="bg-purple-50 p-3 rounded text-xs overflow-x-auto text-purple-900">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>

        {/* Toasts */}
        <div className="fixed top-4 right-4 z-50 space-y-2" aria-live="polite" aria-atomic="true">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`px-4 py-2 rounded shadow border ${t.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}
            >
              {t.message}
            </div>
          ))}
        </div>

        {/* Shortcuts Modal */}
        {showShortcuts && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" onClick={() => setShowShortcuts(false)}>
            <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-lg" onClick={(e)=>e.stopPropagation()}>
              <div className="text-lg font-semibold mb-4 text-purple-900">Keyboard Shortcuts</div>
              <div className="max-h-96 overflow-y-auto">
                <div className="mb-4">
                  <h4 className="font-semibold text-purple-800 mb-2">File Operations</h4>
                  <ul className="text-sm text-purple-900 space-y-1 ml-2">
                    <li><span className="font-mono">Ctrl/Cmd + O</span> – Open/Upload file</li>
                    <li><span className="font-mono">Ctrl/Cmd + S</span> – Save/Download file</li>
                    <li><span className="font-mono">Ctrl/Cmd + T</span> – Insert template</li>
                  </ul>
                </div>
                
                <div className="mb-4">
                  <h4 className="font-semibold text-purple-800 mb-2">Editing</h4>
                  <ul className="text-sm text-purple-900 space-y-1 ml-2">
                    <li><span className="font-mono">Ctrl/Cmd + B</span> – Beautify/Pretty print</li>
                    <li><span className="font-mono">Ctrl/Cmd + M</span> – Minify</li>
                    <li><span className="font-mono">Ctrl/Cmd + Shift + F</span> – Format document</li>
                    <li><span className="font-mono">Ctrl/Cmd + E</span> – Validate</li>
                    <li><span className="font-mono">Ctrl/Cmd + K</span> – Clear editor</li>
                    <li><span className="font-mono">Ctrl/Cmd + D</span> – Duplicate line</li>
                    <li><span className="font-mono">Ctrl/Cmd + L</span> – Delete line</li>
                  </ul>
                </div>
                
                <div className="mb-4">
                  <h4 className="font-semibold text-purple-800 mb-2">Find & Replace</h4>
                  <ul className="text-sm text-purple-900 space-y-1 ml-2">
                    <li><span className="font-mono">Ctrl/Cmd + H</span> – Find/Replace</li>
                    <li><span className="font-mono">F3</span> – Find next</li>
                    <li><span className="font-mono">Shift + F3</span> – Find previous</li>
                  </ul>
                </div>
                
                <div className="mb-4">
                  <h4 className="font-semibold text-purple-800 mb-2">JSON Tools</h4>
                  <ul className="text-sm text-purple-900 space-y-1 ml-2">
                    <li><span className="font-mono">Ctrl/Cmd + U</span> – JSON unescape</li>
                    <li><span className="font-mono">Ctrl/Cmd + Shift + U</span> – JSON escape</li>
                  </ul>
                </div>
                
                <div className="mb-4">
                  <h4 className="font-semibold text-purple-800 mb-2">View (Notepad++ Style)</h4>
                  <ul className="text-sm text-purple-900 space-y-1 ml-2">
                    <li><span className="font-mono">Alt + 0</span> – Collapse/Expand all content</li>
                    <li><span className="font-mono">Alt + 1</span> – Toggle fullscreen</li>
                    <li><span className="font-mono">Alt + 2</span> – Toggle word wrap</li>
                    <li><span className="font-mono">Alt + 3</span> – Toggle theme</li>
                    <li><span className="font-mono">F11</span> – Fullscreen mode</li>
                    <li><span className="font-mono">Esc</span> – Close modals/Exit fullscreen</li>
                  </ul>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={() => setShowShortcuts(false)} className="px-3 py-1 rounded bg-purple-100 border border-purple-200 text-purple-800 text-sm font-semibold hover:bg-purple-200">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
