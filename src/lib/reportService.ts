import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface ReportSection {
  heading: string;
  subheading: string;
  content: string;
  key_takeaways: string[];
}

export interface ExtractedData {
  totalMessages: number;
  topics: { math: number; science: number; general: number; stories: number };
  emotions: { sad: number; distress: number; neutral: number; positive: number };
  unsafe: { selfHarm: number; violence: number; inappropriate: number };
  rude: number;
  engagement: { followUps: number; switches: number };
  emotionalStability: "Stable" | "Needs Attention" | "Unstable";
}

export interface ReportData {
  title: string;
  childName: string;
  date: string;
  sections: ReportSection[];
  metrics_summary: {
    curiosity: number;
    mathConfidence: number;
    attentionSpan: number;
    overall_stability: string;
  };
  extractedData?: ExtractedData;
}

/**
 * Structured Data Extraction Layer
 * Extracts specific metrics from chat history and alerts
 */
export function extractStructuredData(): ExtractedData {
  const activities = JSON.parse(localStorage.getItem("child_activity") || "[]");
  
  // Filter ONLY user messages (assuming they are in child_activity as userText)
  // Our system stores both userText and aiText in the same activity object.
  // We should treat each Activity object as ONE user interaction.
  const userMessages = activities; 
  const totalMessages = userMessages.length;
  
  // Initialize counters
  const topics = { math: 0, science: 0, general: 0, stories: 0 };
  const emotions = { sad: 0, distress: 0, neutral: 0, positive: 0 };
  const unsafe = { selfHarm: 0, violence: 0, inappropriate: 0 };
  let rude = 0;
  
  console.log("[ReportService] Starting Message Classification Traceability:");

  userMessages.forEach((a: any, index: number) => {
    const text = (a.userText || "").toLowerCase();
    const score = a.sentimentScore || 50;
    const category = (a.category || "General").toLowerCase();
    const tags: string[] = [];

    // 1. Primary Category (Non-duplicate)
    if (category === "math") topics.math++;
    else if (category === "science") topics.science++;
    else if (category === "stories") topics.stories++;
    else topics.general++;

    // 2. Emotional Tags (Multiple tags possible, but count only once per message for report)
    let emotionalTagged = false;
    if (score < 30 || text.includes("sad") || text.includes("cry") || text.includes("unhappy")) {
      emotions.sad++;
      tags.push("sad");
      emotionalTagged = true;
    }
    if (score < 50 || text.includes("help") || text.includes("scared") || text.includes("worried")) {
      if (!emotionalTagged || text.includes("scared")) { // Prioritize distress if not already tagged as sad, or if keywords exist
        emotions.distress++;
        tags.push("distress");
      }
    } else if (score > 75 || text.includes("happy") || text.includes("yay") || text.includes("fun") || text.includes("cool")) {
      emotions.positive++;
      tags.push("positive");
    } else {
      emotions.neutral++;
      tags.push("neutral");
    }

    // 3. Unsafe Classification (Refined)
    let unsafeTagged = false;
    
    // Self-harm check
    if (text.includes("kill myself") || text.includes("suicide") || text.includes("hurt myself") || a.risk?.category === "self-harm") {
      unsafe.selfHarm++;
      tags.push("unsafe:selfHarm");
      unsafeTagged = true;
    } 
    
    // Violence vs Curiosity check
    if (!unsafeTagged) {
      const isViolent = (a.risk?.category === "violence" && a.risk?.severity === "high") || 
                        text.includes("kill you") || text.includes("attack");
      
      const isUnsafeCuriosity = text.includes("make a nuke") || text.includes("make a weapon") || text.includes("how to kill");

      if (isViolent) {
        unsafe.violence++;
        tags.push("unsafe:violence");
        unsafeTagged = true;
      } else if (isUnsafeCuriosity) {
        unsafe.inappropriate++;
        tags.push("unsafe:curiosity"); // "make a nuke" -> curiosity/unsafe
        unsafeTagged = true;
      }
    }

    // Rude check
    if (a.status === "filtered" && !unsafeTagged && a.risk?.category !== "safe") {
      rude++;
      tags.push("rude");
    }

    // Log each classified message
    console.log(`[${index + 1}] Message: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}" | Topic: ${category} | Tags: [${tags.join(", ")}]`);
  });
  
  // Convert topics to percentages
  const topicsPercent = { ...topics };
  if (totalMessages > 0) {
    topicsPercent.math = Math.round((topics.math / totalMessages) * 100);
    topicsPercent.science = Math.round((topics.science / totalMessages) * 100);
    topicsPercent.stories = Math.round((topics.stories / totalMessages) * 100);
    topicsPercent.general = Math.round((topics.general / totalMessages) * 100);
  }

  // 4. Emotional Stability Logic
  let emotionalStability: "Stable" | "Needs Attention" | "Unstable" = "Stable";
  if (unsafe.selfHarm > 0) emotionalStability = "Unstable";
  else if (emotions.sad > 0) emotionalStability = "Needs Attention";

  // 5. Engagement Signals
  let followUps = 0;
  let switches = 0;
  for (let i = 0; i < activities.length - 1; i++) {
    const current = activities[i];
    const prev = activities[i + 1];
    if (current.category === prev.category) followUps++;
    else switches++;
  }

  const extracted: ExtractedData = { 
    totalMessages, 
    topics: topicsPercent, 
    emotions, 
    unsafe, 
    rude, 
    engagement: { followUps, switches },
    emotionalStability
  };

  console.log("[ReportService] Final Aggregated Data:", extracted);
  return extracted;
}

/**
 * Gather all relevant data from localStorage
 */
export function gatherAllAppData() {
  console.log("[ReportService] Gathering app data from localStorage...");
  
  // Use production-grade intelligence cache key
  const INTELLIGENCE_CACHE_KEY = "ai_intelligence_cache";
  const intelligenceCache = localStorage.getItem(INTELLIGENCE_CACHE_KEY);
  let intelligence = {};
  if (intelligenceCache) {
    try {
      const parsed = JSON.parse(intelligenceCache);
      intelligence = parsed.data || {};
    } catch (e) {
      console.error("[ReportService] Error parsing intelligence cache:", e);
    }
  }

  const alerts = localStorage.getItem("child_ai_alerts") || "[]";
  const activities = localStorage.getItem("child_activity") || "[]"; // Fixed key
  const growthHistory = localStorage.getItem("child_ai_growth_history") || "[]";
  const screenTime = localStorage.getItem("child_ai_screen_time") || "{}";
  const policy = localStorage.getItem("child_ai_policy") || "{}";

  const extractedData = extractStructuredData();

  return {
    alerts: JSON.parse(alerts),
    activities: JSON.parse(activities),
    intelligence, // Real production intelligence
    growthHistory: JSON.parse(growthHistory),
    screenTime: JSON.parse(screenTime),
    policy: JSON.parse(policy),
    extractedData,
  };
}

/**
 * Generate the PDF report
 */
export async function generatePDFReport(
  data: ReportData,
  onProgress: (progress: number) => void
) {
  console.log("[ReportService] Starting PDF generation with data:", data);
  
  try {
    const doc = new jsPDF({
      orientation: "p",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let currentY = 40;

    // Helper for new page
    const addNewPage = () => {
      doc.addPage();
      currentY = 20;
      // Add page number
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.text(`Page ${pageCount}`, pageWidth - 20, pageHeight - 10);
    };

    // 1. Cover Page
    onProgress(10);
    doc.setFillColor(109, 40, 217); // Primary color
    doc.rect(0, 0, pageWidth, 60, "F");
    
    doc.setFontSize(28);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.text(data.title || "Development Report", margin, 35);
    
    doc.setFontSize(14);
    doc.setTextColor(200, 200, 200);
    doc.text(`Developmental & Behavioral Analysis for ${data.childName || 'Alex'}`, margin, 48);

    currentY = 80;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.text("Executive Overview", margin, currentY);
    currentY += 10;
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    const summary = data.sections && data.sections[0] ? data.sections[0].content : "No summary available.";
    const splitSummary = doc.splitTextToSize(summary, pageWidth - margin * 2);
    doc.text(splitSummary, margin, currentY);
    currentY += splitSummary.length * 5 + 15;

    // Metrics Table
    onProgress(30);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Key Performance Metrics", margin, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [['Metric', 'Score', 'Status']],
      body: [
        ['Curiosity Level', `${data.metrics_summary?.curiosity || 0}%`, (data.metrics_summary?.curiosity || 0) > 70 ? 'Excellent' : 'Developing'],
        ['Math Confidence', `${data.metrics_summary?.mathConfidence || 0}%`, (data.metrics_summary?.mathConfidence || 0) > 70 ? 'Strong' : 'Needs Support'],
        ['Attention Span', `${data.metrics_summary?.attentionSpan || 0}%`, (data.metrics_summary?.attentionSpan || 0) > 70 ? 'Focused' : 'Distracted'],
        ['Emotional Stability', '-', data.metrics_summary?.overall_stability || 'Stable']
      ],
      theme: 'striped',
      headStyles: { fillColor: [109, 40, 217] },
      margin: { left: margin, right: margin }
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;

    // 2. Sections Loop
    if (data.sections && data.sections.length > 1) {
      for (let i = 1; i < data.sections.length; i++) {
        onProgress(30 + (i / data.sections.length) * 60);
        const section = data.sections[i];
        
        if (currentY > pageHeight - 60) {
          addNewPage();
        }

        doc.setFontSize(16);
        doc.setTextColor(109, 40, 217);
        doc.setFont("helvetica", "bold");
        doc.text(section.heading, margin, currentY);
        currentY += 7;

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.setFont("helvetica", "italic");
        doc.text(section.subheading, margin, currentY);
        currentY += 10;

        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        const content = section.content;
        const splitContent = doc.splitTextToSize(content, pageWidth - margin * 2);
        
        // Handle pagination for long content
        for (let line of splitContent) {
          if (currentY > pageHeight - 20) {
            addNewPage();
          }
          doc.text(line, margin, currentY);
          currentY += 6;
        }

        currentY += 10;
        
        // Key Takeaways
        if (section.key_takeaways && section.key_takeaways.length > 0) {
          doc.setFontSize(11);
          doc.setFont("helvetica", "bold");
          doc.text("Strategic Takeaways:", margin, currentY);
          currentY += 7;
          
          doc.setFont("helvetica", "normal");
          section.key_takeaways.forEach(item => {
            if (currentY > pageHeight - 15) addNewPage();
            doc.text(`• ${item}`, margin + 5, currentY);
            currentY += 6;
          });
          currentY += 15;
        }
      }
    }

    onProgress(100);
    const fileName = `${data.childName || 'Alex'}_Development_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    console.log("[ReportService] Saving PDF as:", fileName);
    doc.save(fileName);
    console.log("[ReportService] PDF saved successfully.");
  } catch (error) {
    console.error("[ReportService] FATAL ERROR during PDF generation:", error);
    throw error;
  }
}
