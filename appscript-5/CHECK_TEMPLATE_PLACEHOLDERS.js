/**
 * Check what placeholders exist in the template
 * Run this to see what format your template uses
 */
function checkTemplatePlaceholders() {
  console.log('=== CHECKING TEMPLATE PLACEHOLDERS ===');

  const TEMPLATE_ID = '1L5dnhq0-LCwdRvpgUDF0kb2yt-GBhqDiL9CBCD-8qMI'; // Sesi 1 template

  try {
    // Open template
    const doc = DocumentApp.openById(TEMPLATE_ID);
    const body = doc.getBody();
    const text = body.getText();

    // Find all placeholders (anything between {{ and }})
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    const matches = text.match(placeholderRegex);

    if (!matches || matches.length === 0) {
      console.log('❌ No placeholders found in template');
      return;
    }

    console.log(`\n✅ Found ${matches.length} placeholder instances`);

    // Get unique placeholders
    const uniquePlaceholders = [...new Set(matches)];
    console.log(`\n📋 ${uniquePlaceholders.length} unique placeholders:\n`);

    // Categorize placeholders
    const umPlaceholders = [];
    const otherPlaceholders = [];

    uniquePlaceholders.sort().forEach(p => {
      const lower = p.toLowerCase();
      if (lower.includes('um_') ||
          lower.includes('akaun') ||
          lower.includes('bimb') ||
          lower.includes('pendapatan') ||
          lower.includes('pekerja') ||
          lower.includes('aset') ||
          lower.includes('simpanan') ||
          lower.includes('zakat') ||
          lower.includes('digital') ||
          lower.includes('marketing') ||
          lower.includes('status_penglibatan') ||
          lower.includes('kriteria') ||
          lower.includes('merchant') ||
          lower.includes('fasiliti') ||
          lower.includes('mesinkira') ||
          lower.includes('lawatan')) {
        umPlaceholders.push(p);
      } else {
        otherPlaceholders.push(p);
      }
    });

    console.log('=== UPWARD MOBILITY PLACEHOLDERS ===');
    if (umPlaceholders.length === 0) {
      console.log('❌ No UM placeholders found in template!');
      console.log('You need to add UM placeholders to your template.');
    } else {
      console.log(`✅ Found ${umPlaceholders.length} UM placeholders:\n`);
      umPlaceholders.forEach(p => console.log(p));
    }

    console.log('\n=== OTHER PLACEHOLDERS ===');
    if (otherPlaceholders.length > 0) {
      otherPlaceholders.forEach(p => console.log(p));
    }

    // Check for specific critical UM fields
    console.log('\n=== CHECKING CRITICAL UM FIELDS ===');
    const criticalUM = [
      '{{um_akaun_bimb}}',
      '{{akaun_bimb}}',
      '{{um_pendapatan_semasa}}',
      '{{pendapatan_semasa}}',
      '{{um_status_penglibatan}}',
      '{{status_penglibatan}}'
    ];

    criticalUM.forEach(placeholder => {
      if (uniquePlaceholders.includes(placeholder)) {
        console.log(`✅ ${placeholder}`);
      } else {
        console.log(`❌ MISSING: ${placeholder}`);
      }
    });

    console.log('\n=== FORMAT DETECTION ===');
    const hasUmPrefix = umPlaceholders.some(p => p.includes('um_'));
    const hasNoPrefix = umPlaceholders.some(p => !p.includes('um_') && p !== '{{um_}}');

    if (hasUmPrefix && !hasNoPrefix) {
      console.log('Template uses: {{um_field_name}} format (WITH prefix)');
    } else if (!hasUmPrefix && hasNoPrefix) {
      console.log('Template uses: {{field_name}} format (WITHOUT um_ prefix)');
    } else if (hasUmPrefix && hasNoPrefix) {
      console.log('⚠️ Template uses MIXED formats (both with and without um_ prefix)');
    }

  } catch (err) {
    console.error('Error checking template:', err.toString());
  }

  console.log('\n=== CHECK COMPLETE ===');
}
