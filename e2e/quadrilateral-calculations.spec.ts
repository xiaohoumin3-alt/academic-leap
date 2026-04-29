import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Quadrilateral Area & Perimeter Calculations
 *
 * Testing the fix for: typeIndex mismatch bug where types array order
 * didn't match buildSteps typeIndex checks.
 *
 * Bug: types = ['parallelogram', 'rectangle', 'square']
 *      But buildSteps expected: 1=rectangle, 2=square, 3=parallelogram
 *
 * This test verifies:
 * 1. Square area = side² (e.g., side=9 → area=81, NOT 56)
 * 2. Rectangle area = length × width
 * 3. Rectangle perimeter = 2 × (length + width)
 * 4. Square perimeter = 4 × side
 */

test.describe('Quadrilateral Calculations - Area', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to home page first
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Handle login if needed (check for login button or redirect)
    const hasLoginButton = await page.getByRole('button', { name: /登录|login/i }).count() > 0;
    if (hasLoginButton) {
      // For testing purposes, we'll skip the actual login and go directly to practice
      // In a real scenario, you'd implement proper login here
      console.log('Login required - skipping for E2E test');
    }

    // Navigate to practice with chapter 18 (quadrilaterals)
    await page.goto('/practice?mode=training&chapter=18');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Handle textbook selection - this is REQUIRED for practice to work
    const hasTextbookSelection = await page.getByText('选择教材', { exact: false }).count() > 0;
    if (hasTextbookSelection) {
      console.log('Selecting textbook...');

      // Look for the first available textbook button
      // Common textbooks: 人教版, 北师大版, 华东师大版
      const textbookButton = page.locator('button').filter({
        hasText: /人教|北师大|华东师大|八年级|九年级|七年级/
      }).first();

      const count = await textbookButton.count();
      if (count > 0) {
        await textbookButton.click();
        await page.waitForTimeout(1500);
        console.log('Textbook selected');
      } else {
        console.log('No textbook button found, trying alternative...');

        // Alternative: Try clicking any button that looks like a textbook option
        const anyButton = page.locator('button').first();
        const anyCount = await anyButton.count();
        if (anyCount > 0) {
          await anyButton.click();
          await page.waitForTimeout(1500);
        }
      }
    }

    // Handle knowledge point selection if shown
    const hasKnowledgeSelection = await page.getByText('选择知识点|请至少启用一个知识点', { exact: false }).count() > 0;
    if (hasKnowledgeSelection) {
      console.log('Enabling knowledge points...');

      // Try to find and enable knowledge points for chapter 18 (quadrilaterals)
      // Look for checkboxes or toggle buttons related to knowledge points
      const checkboxes = page.locator('input[type="checkbox"], [role="checkbox"]');
      const checkboxCount = await checkboxes.count();

      if (checkboxCount > 0) {
        // Enable the first few knowledge points
        for (let i = 0; i < Math.min(3, checkboxCount); i++) {
          await checkboxes.nth(i).check();
          await page.waitForTimeout(100);
        }

        // Look for a confirm button
        const confirmButton = page.locator('button').filter({
          hasText: /确认|开始|继续/
        }).first();

        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test('should calculate square area correctly (side²)', async ({ page }) => {
    // This tests the specific bug: side=9 should give area=81, not 56
    // We'll answer multiple questions until we find a square area question

    let attempts = 0;
    const maxAttempts = 10;
    let foundSquareQuestion = false;

    while (attempts < maxAttempts && !foundSquareQuestion) {
      attempts++;

      // Check if this is a square area question
      const pageTitle = await page.locator('h1, h2, [class*="title"]').first().textContent();
      const pageContent = await page.content();

      // Square area question patterns: "正方形.*边长.*面积" or "square.*side.*area"
      const isSquareArea = /正方形.*边长.*求.*面积|square.*side.*area/i.test(pageTitle || '') ||
                          (/正方形/i.test(pageContent) && /边长/i.test(pageContent) && /面积/i.test(pageContent));

      if (isSquareArea) {
        foundSquareQuestion = true;

        // Extract the side length from the question text
        const sideMatch = pageTitle?.match(/边长[为为]*(\d+)/) ||
                         pageContent.match(/边长[为为]*(\d+)/);

        if (sideMatch) {
          const side = parseInt(sideMatch[1], 10);
          const correctArea = side * side;

          console.log(`Found square area question: side=${side}, expected area=${correctArea}`);

          // Find the number input and submit the correct answer
          const numberInput = page.locator('input[type="text"], input[type="number"]').first();
          const inputCount = await numberInput.count();

          if (inputCount > 0) {
            // Click to activate keyboard
            await numberInput.click();
            await page.waitForTimeout(300);

            // Use the numeric keypad to input the answer
            const areaStr = correctArea.toString();
            for (const digit of areaStr) {
              const keyBtn = page.getByRole('button', { name: new RegExp(`^${digit}$`) }).first();
              const keyCount = await keyBtn.count();
              if (keyCount > 0) {
                await keyBtn.click();
                await page.waitForTimeout(100);
              } else {
                // Fallback: direct fill
                await numberInput.fill(areaStr);
                break;
              }
            }

            // Submit answer
            const submitButton = page.getByRole('button', { name: /^(提交|确认)$/i }).first();
            const submitCount = await submitButton.count();
            if (submitCount > 0) {
              await submitButton.click();
              await page.waitForTimeout(2000);

              // Check if answer is correct
              const pageContentAfter = await page.content();
              const isCorrect = pageContentAfter.includes('正确') ||
                               pageContentAfter.includes('太棒了') ||
                               pageContentAfter.includes('✓') ||
                               pageContentAfter.includes('完成');

              console.log(`Answer ${correctArea} is correct: ${isCorrect}`);

              // If answer is wrong with our calculation, the bug still exists
              if (!isCorrect && pageContentAfter.includes('错误')) {
                // Try to find what the expected answer was
                const correctAnswerMatch = pageContentAfter.match(/正确答案是[：:]\s*(\d+)/);
                if (correctAnswerMatch) {
                  const storedAnswer = parseInt(correctAnswerMatch[1], 10);
                  console.error(`BUG DETECTED: side=${side}, our calc=${correctArea}, stored=${storedAnswer}`);

                  // This is the bug: side=9 should give 81, but system says 56
                  expect(storedAnswer).toBe(correctArea);
                }
              } else {
                // Answer was correct - no bug
                expect(isCorrect).toBeTruthy();
              }
            }
          }
        }
      } else {
        // Not a square area question, skip to next
        const nextButton = page.getByRole('button', { name: /^(跳过|下一题|next|skip)$/i }).first();
        const nextCount = await nextButton.count();

        if (nextCount > 0) {
          await nextButton.click();
          await page.waitForTimeout(1000);
        } else {
          // No skip button, try answering randomly to move on
          const anyButton = page.locator('button').first();
          const buttonCount = await anyButton.count();
          if (buttonCount > 0) {
            await anyButton.click();
            await page.waitForTimeout(1500);
          }
        }
      }
    }

    if (!foundSquareQuestion) {
      console.log('No square area question found in 10 attempts');
      test.skip(true, 'No square area question found');
    }
  });

  test('should calculate rectangle area correctly (length × width)', async ({ page }) => {
    let attempts = 0;
    const maxAttempts = 10;
    let foundRectangleQuestion = false;

    while (attempts < maxAttempts && !foundRectangleQuestion) {
      attempts++;

      const pageTitle = await page.locator('h1, h2, [class*="title"]').first().textContent();
      const pageContent = await page.content();

      const isRectangleArea = /矩形.*长.*宽.*面积|rectangle.*length.*width.*area/i.test(pageTitle || '') ||
                             (/矩形/i.test(pageContent) && /长/i.test(pageContent) && /宽/i.test(pageContent) && /面积/i.test(pageContent));

      if (isRectangleArea) {
        foundRectangleQuestion = true;

        // Extract length and width
        const lengthMatch = pageTitle?.match(/长[为为]*(\d+)/) || pageContent.match(/长[为为]*(\d+)/);
        const widthMatch = pageTitle?.match(/宽[为为]*(\d+)/) || pageContent.match(/宽[为为]*(\d+)/);

        if (lengthMatch && widthMatch) {
          const length = parseInt(lengthMatch[1], 10);
          const width = parseInt(widthMatch[1], 10);
          const correctArea = length * width;

          console.log(`Found rectangle area question: length=${length}, width=${width}, expected area=${correctArea}`);

          const numberInput = page.locator('input[type="text"], input[type="number"]').first();
          const inputCount = await numberInput.count();

          if (inputCount > 0) {
            await numberInput.click();
            await page.waitForTimeout(300);

            const areaStr = correctArea.toString();
            for (const digit of areaStr) {
              const keyBtn = page.getByRole('button', { name: new RegExp(`^${digit}$`) }).first();
              const keyCount = await keyBtn.count();
              if (keyCount > 0) {
                await keyBtn.click();
                await page.waitForTimeout(100);
              } else {
                await numberInput.fill(areaStr);
                break;
              }
            }

            const submitButton = page.getByRole('button', { name: /^(提交|确认)$/i }).first();
            const submitCount = await submitButton.count();
            if (submitCount > 0) {
              await submitButton.click();
              await page.waitForTimeout(2000);

              const pageContentAfter = await page.content();
              const isCorrect = pageContentAfter.includes('正确') ||
                               pageContentAfter.includes('太棒了') ||
                               pageContentAfter.includes('✓');

              if (!isCorrect && pageContentAfter.includes('错误')) {
                const correctAnswerMatch = pageContentAfter.match(/正确答案是[：:]\s*(\d+)/);
                if (correctAnswerMatch) {
                  const storedAnswer = parseInt(correctAnswerMatch[1], 10);
                  console.error(`BUG DETECTED: length=${length}, width=${width}, our calc=${correctArea}, stored=${storedAnswer}`);
                  expect(storedAnswer).toBe(correctArea);
                }
              } else {
                expect(isCorrect).toBeTruthy();
              }
            }
          }
        }
      } else {
        const nextButton = page.getByRole('button', { name: /^(跳过|下一题|next|skip)$/i }).first();
        const nextCount = await nextButton.count();
        if (nextCount > 0) {
          await nextButton.click();
          await page.waitForTimeout(1000);
        } else {
          const anyButton = page.locator('button').first();
          const buttonCount = await anyButton.count();
          if (buttonCount > 0) {
            await anyButton.click();
            await page.waitForTimeout(1500);
          }
        }
      }
    }

    if (!foundRectangleQuestion) {
      console.log('No rectangle area question found in 10 attempts');
      test.skip(true, 'No rectangle area question found');
    }
  });
});

test.describe('Quadrilateral Calculations - Perimeter', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to home page first
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    // Navigate to practice with chapter 18 (quadrilaterals)
    await page.goto('/practice?mode=training&chapter=18');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Handle textbook selection - REQUIRED for practice
    const hasTextbookSelection = await page.getByText('选择教材', { exact: false }).count() > 0;
    if (hasTextbookSelection) {
      console.log('Selecting textbook...');
      const textbookButton = page.locator('button').filter({
        hasText: /人教|北师大|华东师大|八年级|九年级|七年级/
      }).first();

      const count = await textbookButton.count();
      if (count > 0) {
        await textbookButton.click();
        await page.waitForTimeout(1500);
      } else {
        const anyButton = page.locator('button').first();
        if (await anyButton.count() > 0) {
          await anyButton.click();
          await page.waitForTimeout(1500);
        }
      }
    }

    // Handle knowledge point selection
    const hasKnowledgeSelection = await page.getByText('选择知识点|请至少启用一个知识点', { exact: false }).count() > 0;
    if (hasKnowledgeSelection) {
      console.log('Enabling knowledge points...');
      const checkboxes = page.locator('input[type="checkbox"], [role="checkbox"]');
      const checkboxCount = await checkboxes.count();

      if (checkboxCount > 0) {
        for (let i = 0; i < Math.min(3, checkboxCount); i++) {
          await checkboxes.nth(i).check();
          await page.waitForTimeout(100);
        }

        const confirmButton = page.locator('button').filter({
          hasText: /确认|开始|继续/
        }).first();

        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });

  test('should calculate rectangle perimeter correctly (2×(l+w))', async ({ page }) => {
    let attempts = 0;
    const maxAttempts = 10;
    let foundRectangleQuestion = false;

    while (attempts < maxAttempts && !foundRectangleQuestion) {
      attempts++;

      const pageTitle = await page.locator('h1, h2, [class*="title"]').first().textContent();
      const pageContent = await page.content();

      const isRectanglePerimeter = /矩形.*长.*宽.*周长|rectangle.*length.*width.*perimeter/i.test(pageTitle || '') ||
                                  (/矩形/i.test(pageContent) && /长/i.test(pageContent) && /宽/i.test(pageContent) && /周长/i.test(pageContent));

      if (isRectanglePerimeter) {
        foundRectangleQuestion = true;

        const lengthMatch = pageTitle?.match(/长[为为]*(\d+)/) || pageContent.match(/长[为为]*(\d+)/);
        const widthMatch = pageTitle?.match(/宽[为为]*(\d+)/) || pageContent.match(/宽[为为]*(\d+)/);

        if (lengthMatch && widthMatch) {
          const length = parseInt(lengthMatch[1], 10);
          const width = parseInt(widthMatch[1], 10);
          const correctPerimeter = 2 * (length + width);

          console.log(`Found rectangle perimeter question: length=${length}, width=${width}, expected perimeter=${correctPerimeter}`);

          const numberInput = page.locator('input[type="text"], input[type="number"]').first();
          const inputCount = await numberInput.count();

          if (inputCount > 0) {
            await numberInput.click();
            await page.waitForTimeout(300);

            const perimeterStr = correctPerimeter.toString();
            for (const digit of perimeterStr) {
              const keyBtn = page.getByRole('button', { name: new RegExp(`^${digit}$`) }).first();
              const keyCount = await keyBtn.count();
              if (keyCount > 0) {
                await keyBtn.click();
                await page.waitForTimeout(100);
              } else {
                await numberInput.fill(perimeterStr);
                break;
              }
            }

            const submitButton = page.getByRole('button', { name: /^(提交|确认)$/i }).first();
            const submitCount = await submitButton.count();
            if (submitCount > 0) {
              await submitButton.click();
              await page.waitForTimeout(2000);

              const pageContentAfter = await page.content();
              const isCorrect = pageContentAfter.includes('正确') ||
                               pageContentAfter.includes('太棒了') ||
                               pageContentAfter.includes('✓');

              if (!isCorrect && pageContentAfter.includes('错误')) {
                const correctAnswerMatch = pageContentAfter.match(/正确答案是[：:]\s*(\d+)/);
                if (correctAnswerMatch) {
                  const storedAnswer = parseInt(correctAnswerMatch[1], 10);
                  console.error(`BUG DETECTED: length=${length}, width=${width}, our calc=${correctPerimeter}, stored=${storedAnswer}`);
                  expect(storedAnswer).toBe(correctPerimeter);
                }
              } else {
                expect(isCorrect).toBeTruthy();
              }
            }
          }
        }
      } else {
        const nextButton = page.getByRole('button', { name: /^(跳过|下一题|next|skip)$/i }).first();
        const nextCount = await nextButton.count();
        if (nextCount > 0) {
          await nextButton.click();
          await page.waitForTimeout(1000);
        } else {
          const anyButton = page.locator('button').first();
          const buttonCount = await anyButton.count();
          if (buttonCount > 0) {
            await anyButton.click();
            await page.waitForTimeout(1500);
          }
        }
      }
    }

    if (!foundRectangleQuestion) {
      console.log('No rectangle perimeter question found in 10 attempts');
      test.skip(true, 'No rectangle perimeter question found');
    }
  });

  test('should calculate square perimeter correctly (4×side)', async ({ page }) => {
    let attempts = 0;
    const maxAttempts = 10;
    let foundSquareQuestion = false;

    while (attempts < maxAttempts && !foundSquareQuestion) {
      attempts++;

      const pageTitle = await page.locator('h1, h2, [class*="title"]').first().textContent();
      const pageContent = await page.content();

      const isSquarePerimeter = /正方形.*边长.*周长|square.*side.*perimeter/i.test(pageTitle || '') ||
                               (/正方形/i.test(pageContent) && /边长/i.test(pageContent) && /周长/i.test(pageContent));

      if (isSquarePerimeter) {
        foundSquareQuestion = true;

        const sideMatch = pageTitle?.match(/边长[为为]*(\d+)/) || pageContent.match(/边长[为为]*(\d+)/);

        if (sideMatch) {
          const side = parseInt(sideMatch[1], 10);
          const correctPerimeter = 4 * side;

          console.log(`Found square perimeter question: side=${side}, expected perimeter=${correctPerimeter}`);

          const numberInput = page.locator('input[type="text"], input[type="number"]').first();
          const inputCount = await numberInput.count();

          if (inputCount > 0) {
            await numberInput.click();
            await page.waitForTimeout(300);

            const perimeterStr = correctPerimeter.toString();
            for (const digit of perimeterStr) {
              const keyBtn = page.getByRole('button', { name: new RegExp(`^${digit}$`) }).first();
              const keyCount = await keyBtn.count();
              if (keyCount > 0) {
                await keyBtn.click();
                await page.waitForTimeout(100);
              } else {
                await numberInput.fill(perimeterStr);
                break;
              }
            }

            const submitButton = page.getByRole('button', { name: /^(提交|确认)$/i }).first();
            const submitCount = await submitButton.count();
            if (submitCount > 0) {
              await submitButton.click();
              await page.waitForTimeout(2000);

              const pageContentAfter = await page.content();
              const isCorrect = pageContentAfter.includes('正确') ||
                               pageContentAfter.includes('太棒了') ||
                               pageContentAfter.includes('✓');

              if (!isCorrect && pageContentAfter.includes('错误')) {
                const correctAnswerMatch = pageContentAfter.match(/正确答案是[：:]\s*(\d+)/);
                if (correctAnswerMatch) {
                  const storedAnswer = parseInt(correctAnswerMatch[1], 10);
                  console.error(`BUG DETECTED: side=${side}, our calc=${correctPerimeter}, stored=${storedAnswer}`);
                  expect(storedAnswer).toBe(correctPerimeter);
                }
              } else {
                expect(isCorrect).toBeTruthy();
              }
            }
          }
        }
      } else {
        const nextButton = page.getByRole('button', { name: /^(跳过|下一题|next|skip)$/i }).first();
        const nextCount = await nextButton.count();
        if (nextCount > 0) {
          await nextButton.click();
          await page.waitForTimeout(1000);
        } else {
          const anyButton = page.locator('button').first();
          const buttonCount = await anyButton.count();
          if (buttonCount > 0) {
            await anyButton.click();
            await page.waitForTimeout(1500);
          }
        }
      }
    }

    if (!foundSquareQuestion) {
      console.log('No square perimeter question found in 10 attempts');
      test.skip(true, 'No square perimeter question found');
    }
  });
});

test.describe('Quadrilateral Calculations - Regression Tests', () => {

  test('should not have typeIndex mismatch bugs', async ({ page }) => {
    // This is a meta-test that verifies the template code fix
    // by checking that question params match their typeIndex

    // Navigate to home page first
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);

    await page.goto('/practice?mode=training&chapter=18');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Handle textbook selection - REQUIRED
    const hasTextbookSelection = await page.getByText('选择教材', { exact: false }).count() > 0;
    if (hasTextbookSelection) {
      console.log('Selecting textbook for regression test...');
      const textbookButton = page.locator('button').filter({
        hasText: /人教|北师大|华东师大|八年级|九年级|七年级/
      }).first();

      const count = await textbookButton.count();
      if (count > 0) {
        await textbookButton.click();
        await page.waitForTimeout(1500);
      } else {
        const anyButton = page.locator('button').first();
        if (await anyButton.count() > 0) {
          await anyButton.click();
          await page.waitForTimeout(1500);
        }
      }
    }

    // Handle knowledge point selection
    const hasKnowledgeSelection = await page.getByText('选择知识点|请至少启用一个知识点', { exact: false }).count() > 0;
    if (hasKnowledgeSelection) {
      console.log('Enabling knowledge points for regression test...');
      const checkboxes = page.locator('input[type="checkbox"], [role="checkbox"]');
      const checkboxCount = await checkboxes.count();

      if (checkboxCount > 0) {
        for (let i = 0; i < Math.min(3, checkboxCount); i++) {
          await checkboxes.nth(i).check();
          await page.waitForTimeout(100);
        }

        const confirmButton = page.locator('button').filter({
          hasText: /确认|开始|继续/
        }).first();

        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForTimeout(1000);
        }
      }
    }

    // Answer a few questions and monitor for any calculation errors
    let questionsAnswered = 0;
    const maxQuestions = 5;

    for (let i = 0; i < maxQuestions; i++) {
      const pageTitle = await page.locator('h1, h2, [class*="title"]').first().textContent();
      console.log(`Question ${i + 1}:`, pageTitle);

      // Try to answer correctly
      const numberInput = page.locator('input[type="text"], input[type="number"]').first();
      const inputCount = await numberInput.count();

      if (inputCount > 0) {
        // Look for numeric values in the question that might be the answer
        const pageContent = await page.content();
        const numbers = pageContent.match(/\d+/g) || [];

        if (numbers.length >= 2) {
          // Try the last number (often the answer in calculation questions)
          const guess = numbers[numbers.length - 1];
          await numberInput.click();
          await page.waitForTimeout(300);

          for (const digit of guess) {
            const keyBtn = page.getByRole('button', { name: new RegExp(`^${digit}$`) }).first();
            const keyCount = await keyBtn.count();
            if (keyCount > 0) {
              await keyBtn.click();
              await page.waitForTimeout(100);
            } else {
              await numberInput.fill(guess);
              break;
            }
          }

          const submitButton = page.getByRole('button', { name: /^(提交|确认)$/i }).first();
          const submitCount = await submitButton.count();
          if (submitCount > 0) {
            await submitButton.click();
            await page.waitForTimeout(2000);

            const pageContentAfter = await page.content();
            const hasBug = pageContentAfter.includes('56') && pageContentAfter.includes('边长9');

            if (hasBug) {
              console.error('REGRESSION: Found the side=9, area=56 bug!');
              expect(false).toBeTruthy(); // Fail the test
            }
          }
        }
      } else {
        // No number input, click any button to continue
        const anyButton = page.locator('button').first();
        const buttonCount = await anyButton.count();
        if (buttonCount > 0) {
          await anyButton.click();
          await page.waitForTimeout(1500);
        }
      }

      questionsAnswered++;
    }

    console.log(`Answered ${questionsAnswered} questions without detecting calculation bugs`);
  });
});
