import { AppFrontend } from 'test/e2e/pageobjects/app-frontend';

import { groupIsRepeatingExt } from 'src/layout/Group/tools';

const appFrontend = new AppFrontend();

it('should be possible to hide rows when "Endre fra" is greater or equals to [...]', () => {
  cy.goto('group');
  cy.intercept('PUT', '**/data/**').as('putFormData');
  for (const prefill of Object.values(appFrontend.group.prefill)) {
    cy.get(prefill).dsCheck();
    cy.wait('@putFormData');
  }
  const headerRow = 1;

  cy.get(appFrontend.nextButton).click();
  cy.get(appFrontend.group.showGroupToContinue).find('input').dsCheck();

  // We start off with 5 rows in the repeating group
  cy.get(appFrontend.group.mainGroup)
    .find('tr')
    .should('have.length', 5 + headerRow);
  cy.get(appFrontend.group.hiddenRowsInfoMsg).should('not.exist');

  // When hiding every row with value over 1, all rows including the header should be hidden
  cy.get(appFrontend.group.hideRepeatingGroupRow).numberFormatClear();
  cy.get(appFrontend.group.hideRepeatingGroupRow).type('1');
  cy.get(appFrontend.group.mainGroup).find('tr').should('not.exist');
  cy.get(appFrontend.group.hiddenRowsInfoMsg).should('exist');

  // Hiding rows with value over 1000 to split the group in two
  cy.get(appFrontend.group.hideRepeatingGroupRow).numberFormatClear();
  cy.get(appFrontend.group.hideRepeatingGroupRow).type('1000');
  cy.get(appFrontend.group.mainGroup)
    .find('tr')
    .should('have.length', 2 + headerRow);

  // Make sure the other 3 rows are in the overflow group on the next page
  const rowsAfter = 2;
  cy.navPage('repeating (store endringer)').click();
  cy.get(appFrontend.group.overflowGroup).should('exist');
  cy.get(appFrontend.group.overflowGroup)
    .find('tr')
    .should('have.length', 3 + headerRow + rowsAfter);

  cy.get(appFrontend.group.overflowGroup).find('tr').first().find('th').as('firstRow');
  cy.get(appFrontend.group.overflowGroup).find('tr').last().find('td').as('lastRow');

  // Make sure the sum row is correct
  cy.get('@lastRow').eq(0).should('contain.text', 'SUM');
  cy.get('@lastRow').eq(1).find('input').should('have.value', 'NOK 9 045 621');
  cy.get('@lastRow').eq(2).find('input').should('have.value', 'NOK 9 045 387');

  // Testing column order. The repeating group defines its children as "Endre fra", "Endre til", "Kilde", but the
  // column order is overridden to be "Kilde", "Endre fra", "Endre til".
  cy.get('@firstRow').eq(0).should('contain.text', 'Kilde');
  cy.get('@firstRow').eq(1).should('contain.text', 'Endre fra');
  cy.get('@firstRow').eq(2).should('contain.text', 'Endre til');

  // Take a screenshot, but make sure the preselectedOptionIndex in all Dropdowns take effect first
  cy.get(appFrontend.group.overflowGroup).find('[data-componenttype=Dropdown] input').should('have.value', 'Altinn');
  cy.snapshot('hide-row-in-group');

  // Adding a new row to the repeating group should automatically move it to the overflow group on the next page
  cy.navPage('repeating').click();
  cy.get(appFrontend.group.addNewItem).click();
  cy.get(appFrontend.group.newValue).type('987554');
  cy.get(appFrontend.group.currentValue).type('1500');
  cy.get(appFrontend.group.currentValue).should('not.exist');

  // There used to be a bug here, where the row would be moved to the overflow group, but still be in edit-mode
  // according to our internal state. When this is no longer the case, it should be possible to click the "Add new
  // item"-button again, even after the row we just edited disappeared.
  cy.get(appFrontend.group.addNewItem).should('be.visible');
  cy.get(appFrontend.group.editContainer).should('not.exist');
  cy.get(appFrontend.group.saveMainGroup).should('not.exist');

  // Make sure the new row is now in the overflow group on the next page
  cy.navPage('repeating (store endringer)').click();
  cy.get(appFrontend.group.overflowGroup)
    .find('tr')
    .eq(headerRow + 3)
    .find('td')
    .as('newRow');
  cy.get('@newRow').eq(1).find('input').should('have.value', 'NOK 1 500');
  cy.get('@newRow').eq(2).find('input').should('have.value', 'NOK 987 554');

  // This should change the value to NOK 150, and move the row back to the first group
  cy.get('@newRow').eq(1).find('input').type('{moveToEnd}{moveToEnd}{moveToEnd}{backspace}');

  cy.navPage('repeating').click();

  // When we had the bug mentioned above, the row would be moved back to the first group, but still be in edit-mode
  // according to our internal state. No that this is fixed, there should be no edit-container.
  cy.get(appFrontend.group.editContainer).should('not.exist');

  // Make sure the row is now in the first group again
  cy.get(appFrontend.group.mainGroup)
    .find('tr')
    .should('have.length', 3 + headerRow);
  cy.get(appFrontend.group.mainGroup).find('tr').last().find('td').as('lastRow');
  cy.get('@lastRow').eq(0).should('contain.text', 'NOK 150');
  cy.get('@lastRow').eq(1).should('contain.text', 'NOK 987 554');

  function verifyNumCells() {
    // Verify the number of table cells in the overflow group. This broke once, when the node.children() function
    // returned the children including the static rows after, making a static component pop up in the group table as
    // a column. We need to check this when tableColumns and tableHeaders are undefined to make sure they don't
    // interfere and remove cells that would otherwise be shown in the table as children.
    cy.get(appFrontend.group.overflowGroup)
      .find('tr')
      .should('have.length', 3 + headerRow + rowsAfter);
    cy.get(appFrontend.group.overflowGroup).find('tr').eq(0).find('th').should('have.length', 3);
    cy.get(appFrontend.group.overflowGroup).find('tr').eq(1).find('td').should('have.length', 3);
    cy.get(appFrontend.group.overflowGroup).find('tr').last().find('td').should('have.length', 3);
  }

  cy.navPage('repeating (store endringer)').click();
  verifyNumCells();
  cy.interceptLayout('group', (c) => {
    if (c.id === 'mainGroup2' && c.type === 'Group' && groupIsRepeatingExt(c)) {
      c.tableColumns = undefined;
      c.tableHeaders = undefined;
    }
  });
  cy.reload();
  verifyNumCells();
});

it('"save and next"-button should open row 3 when row 2 is hidden', () => {
  cy.goto('group');
  cy.get(appFrontend.nextButton).click();
  cy.changeLayout((c) => {
    if (c.type === 'Group' && c.id === 'mainGroup' && groupIsRepeatingExt(c) && c.edit) {
      c.edit.saveAndNextButton = true;
    }
  });
  cy.get(appFrontend.group.showGroupToContinue).find('input').dsCheck();
  ['1', '6', '2'].forEach((value) => {
    cy.get(appFrontend.group.addNewItem).click();
    cy.get(appFrontend.group.currentValue).type(value);
    cy.get(appFrontend.group.saveMainGroup).click();
  });
  cy.get(appFrontend.group.hideRepeatingGroupRow).numberFormatClear();
  cy.get(appFrontend.group.hideRepeatingGroupRow).type('5');
  cy.get(appFrontend.group.row(0).editBtn).click();
  cy.get(appFrontend.group.saveAndNextMainGroup).click();
  cy.get(appFrontend.group.currentValue).should('have.value', 'NOK 2');
  cy.get(appFrontend.group.saveAndNextMainGroup).should('not.exist');
});
