import {expect} from '@playwright/test';
// Enter through actual startup UI. Never replace the coordinator or its startup state.
// Existing suites install a paused browser clock; media/audio remains independently timed.
export async function finishStartup(page) {
 await expect(page.getByRole('status')).toHaveText('Startup LOGO');
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await page.clock.runFor(400);
 await expect(page.getByRole('status')).toHaveText('Startup INTRO');
 await page.getByRole('button',{name:'Skip movie',exact:true}).click();
 await page.clock.runFor(600);
 await expect(page.getByRole('status')).toContainText('Setup state 1');
}
