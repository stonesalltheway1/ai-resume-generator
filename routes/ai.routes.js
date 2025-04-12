const express = require('express');
const router = express.Router();
const axios = require('axios');
const authMiddleware = require('../middleware/auth.middleware');

// Middleware to check if user is authenticated
router.use(authMiddleware);

// Generate resume summary
router.post('/generate-summary', async (req, res) => {
  try {
    const { personalInfo, experience, skills } = req.body;
    
    // Format the prompt
    const prompt = `Generate a professional resume summary based on this information:
Personal Info: ${JSON.stringify(personalInfo)}
Experience: ${JSON.stringify(experience)}
Skills: ${JSON.stringify(skills)}`;
    
    // Make API call to Claude
    const aiResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: "claude-3-sonnet-20240229",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: prompt
      }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });
    
    // Extract the generated text
    const summary = aiResponse.data.content[0].text;
    
    res.json({ summary });
  } catch (error) {
    console.error('AI Generate Summary Error:', error.response?.data || error.message);
    res.status(500).json({ message: 'Error generating summary' });
  }
});

// Enhance experience descriptions
router.post('/enhance-experience', async (req, res) => {
  try {
    const { experience } = req.body;
    
    const enhancedExperience = [...experience];
    
    // Process each experience item
    for (let i = 0; i < enhancedExperience.length; i++) {
      const exp = enhancedExperience[i];
      
      if (exp.bullets && exp.bullets.length > 0) {
        // Format the prompt
        const prompt = `Transform these work experience bullet points into more powerful descriptions focused on achievements, impact, and results. Include metrics and quantifiable results when appropriate:
${exp.bullets.join('\n')}`;
        
        // Make API call to Claude
        const aiResponse = await axios.post('https://api.anthropic.com/v1/messages', {
          model: "claude-3-sonnet-20240229",
          max_tokens: 1024,
          messages: [{
            role: "user",
            content: prompt
          }]
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
          }
        });
        
        // Extract the enhanced bullet points
        const enhancedText = aiResponse.data.content[0].text;
        const bulletArray = enhancedText.split('\n').filter(bullet => bullet.trim().length > 0);
        
        if (bulletArray.length > 0) {
          enhancedExperience[i].bullets = bulletArray.map(bullet => {
            // Remove bullet point markers if present
            return bullet.replace(/^[-•*]\s+/, '').trim();
          });
        }
      }
    }
    
    res.json({ enhancedExperience });
  } catch (error) {
    console.error('AI Enhance Experience Error:', error.response?.data || error.message);
    res.status(500).json({ message: 'Error enhancing experience' });
  }
});

// Suggest skills
router.post('/suggest-skills', async (req, res) => {
  try {
    const { jobTitle, experience } = req.body;
    
    // Format the experience context
    const experienceContext = experience.map(exp => 
      `Position: ${exp.position}\nCompany: ${exp.company}\nResponsibilities: ${exp.bullets.join('; ')}`
    ).join('\n\n');
    
    // Format the prompt
    const prompt = `Based on the following job title and experience, suggest 10-15 relevant and in-demand skills that would make the resume more competitive. Include both technical and soft skills where appropriate. Return only a list of skills, one per line.
Job Title: ${jobTitle || 'Not specified'}
Experience:
${experienceContext}`;
    
    // Make API call to Claude
    const aiResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: "claude-3-sonnet-20240229",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: prompt
      }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });
    
    // Extract and format the suggested skills
    const skillsText = aiResponse.data.content[0].text;
    const suggestedSkills = skillsText.split('\n')
      .map(skill => skill.replace(/^[-•*]\s+/, '').trim())
      .filter(skill => skill.length > 0);
    
    res.json({ suggestedSkills });
  } catch (error) {
    console.error('AI Suggest Skills Error:', error.response?.data || error.message);
    res.status(500).json({ message: 'Error suggesting skills' });
  }
});

// Analyze job description for ATS optimization
router.post('/analyze-job', async (req, res) => {
  try {
    const { resumeData, jobDescription } = req.body;
    
    // Format the resume content
    const resumeContent = `
Personal Info:
${resumeData.personalInfo.fullName} - ${resumeData.personalInfo.jobTitle}

Summary:
${resumeData.personalInfo.summary}

Experience:
${resumeData.experience.map(exp => 
  `${exp.position} at ${exp.company}\n${exp.bullets.join('\n')}`
).join('\n\n')}

Education:
${resumeData.education.map(edu => 
  `${edu.degree} from ${edu.institution}`
).join('\n')}

Skills:
${resumeData.skills.join(', ')}
`;
    
    // Format the prompt
    const prompt = `Analyze this job description and resume content:

JOB DESCRIPTION:
${jobDescription}

RESUME CONTENT:
${resumeContent}

1. Extract important keywords and phrases from the job description.
2. Check which keywords are present or missing in the resume.
3. Calculate a match score (0-100) based on keyword match percentage.
4. Provide a list of 5-10 missing keywords that should be added to the resume.

Format your response exactly like this:
SCORE: [numerical score]
MISSING KEYWORDS: [comma-separated list of keywords]`;
    
    // Make API call to Claude
    const aiResponse = await axios.post('https://api.anthropic.com/v1/messages', {
      model: "claude-3-sonnet-20240229",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: prompt
      }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });
    
    // Parse the results
    const analysisText = aiResponse.data.content[0].text;
    
    const scoreMatch = analysisText.match(/SCORE:\s*(\d+)/i);
    const keywordsMatch = analysisText.match(/MISSING KEYWORDS:\s*(.+?)(?:\n|$)/i);
    
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 65;
    const keywordsText = keywordsMatch ? keywordsMatch[1] : '';
    const keywords = keywordsText
      .split(',')
      .map(kw => kw.trim())
      .filter(kw => kw.length > 0);
    
    res.json({
      score,
      keywords
    });
  } catch (error) {
    console.error('AI Analyze Job Error:', error.response?.data || error.message);
    res.status(500).json({ message: 'Error analyzing job description' });
  }
});

module.exports = router;