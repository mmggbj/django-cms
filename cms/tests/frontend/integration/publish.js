/* global DateTimeShortcuts */
'use strict';

// #############################################################################
// Publishing a page with a publish date

var globals = require('./settings/globals');
var cms = require('./helpers/cms')();

var SECOND_PAGE_TITLE = 'Second'; // we rely on slug being "/second"

casper.test.setUp(function (done) {
    casper.start()
        .then(cms.login())
        .then(cms.addPage({ title: 'First page' }))
        .then(cms.addPage({ title: SECOND_PAGE_TITLE }))
        .run(done);
});

casper.test.tearDown(function (done) {
    casper.start()
        .then(cms.login())
        .then(cms.removePage())
        .then(cms.removePage())
        .then(cms.logout())
        .run(done);
});

casper.test.begin('Publishing a page with publish button', function (test) {
    var pageUrl = (globals.baseUrl + SECOND_PAGE_TITLE).toLowerCase() + '/';
    var pageTitle;

    // open an unpublished new page
    casper.start(pageUrl + '?edit')
        .waitForSelector('.cms-toolbar-expanded', function () {
            pageTitle = this.getTitle();

            test.assertSelectorHasText(
                '.cms-publish-page',
                'Publish page now',
                'Page is unpublished'
            );
        })
        .then(cms.logout())
        // check that the page is 404
        .thenOpen(pageUrl, function () {
            test.assertTitleMatch(/Page not found/, 'The page is not yet available');
        })
        .then(cms.login())
        .thenOpen(pageUrl + '?edit')
        // clicking on 'Publish page now' button
        .waitForSelector('.cms-toolbar-expanded', function () {
            // handles confirm popup
            this.setFilter('page.confirm', function () {
                return true;
            });

            this.click('.cms-btn-publish');
        })
        // wait until it successfully publishes
        .waitForResource(/publish/)
        .then(cms.logout())
        // open a page and check if it's published for non-logged in user
        .thenOpen(pageUrl, function () {
            test.assertTitleMatch(new RegExp(pageTitle), 'The page is published and available');
        })
        .then(function () {
            this.removeAllFilters();
        })
        .run(function () {
            test.done();
        });
});

casper.test.begin('Publishing dates', function (test) {
    var pageUrl = (globals.baseUrl + SECOND_PAGE_TITLE).toLowerCase() + '/';
    var pageTitle;
    var publishDate;
    var publishTime;

    casper
        .start(globals.editUrl)
        // opening an unpublished new page
        .waitForSelector('.cms-toolbar-expanded')
        .then(function () {
            this.thenOpen(pageUrl);
        })
        // checking that it isn't published
        .waitForSelector('.cms-toolbar-expanded', function () {
            pageTitle = this.getTitle();

            test.assertSelectorHasText(
                '.cms-publish-page',
                'Publish page now',
                'Page is unpublished'
            );

            this.click('.cms-toolbar-item-navigation > li:nth-child(2) > a');
        })
        // opening "Publishing dates" menu item
        .waitForSelector('.cms-toolbar-item-navigation-hover', function () {
            this.click('.cms-toolbar-item-navigation-hover a[href$="/dates/"]');
        })
        .withFrame(0, function () {
            casper
                // updating the publish time in the field and grabbing that value
                .waitUntilVisible('#page_form', function () {
                    publishDate = this.evaluate(function () {
                        DateTimeShortcuts.handleCalendarQuickLink(0, 0);
                        return $('#id_publication_date_0').val();
                    });

                    publishTime = this.evaluate(function () {
                        DateTimeShortcuts.handleClockQuicklink(0, -1);
                        return $('#id_publication_date_1').val();
                    });
                })
                .then(function () {
                    // publish time is in a minute
                    var year = publishDate.substring(0, 4);
                    var month = publishDate.substring(5, 7);
                    var day = publishDate.substring(8, 10);
                    var hours = publishTime.substring(0, 2);
                    var minutes = publishTime.substring(3, 5);
                    var seconds = publishTime.substring(6, 8);

                    // adding one minute to the publish time
                    var timestamp = new Date(year, month, day, hours, minutes, seconds);

                    timestamp.setMinutes(timestamp.getMinutes() + 1);
                    minutes = timestamp.getMinutes();
                    if (minutes < 10) {
                        minutes = '0' + minutes;
                    }

                    publishTime = timestamp.getHours() + ':' + minutes + ':' + timestamp.getSeconds();

                    casper.echo('Publish time (Server) is: ' + publishTime);

                    this.fill('#page_form', {
                        publication_date_1: publishTime
                    });
                });
        })
        // submitting the updated publish time
        .then(function () {
            this.click('.cms-modal .cms-btn-action');
        })
        // clicking on 'Publish page now' button
        .waitForSelector('.cms-toolbar-expanded', function () {
            // handles confirm popup
            this.setFilter('page.confirm', function () {
                return true;
            });

            this.click('.cms-btn-publish');
        })
        .waitForResource(/publish/)
        // logging out through toolbar
        .thenOpen(globals.editUrl)
        .waitForSelector('.cms-toolbar-expanded', function () {
            this.click('.cms-toolbar-item-navigation li:first-child a');
        })
        .waitForSelector('.cms-toolbar-item-navigation-hover', function () {
            this.click('.cms-toolbar-item-navigation-hover a[href$="/admin/logout/"]');
        })
        .waitForResource(/admin/)
        .wait(1000)
        .waitForSelector('body', function () {
            test.assertDoesntExist('.cms-toolbar', 'Successfully logged out');
        })
        // going to the newly created page url and checking that it hasn't been published yet
        .thenOpen(pageUrl, function () {
            test.assertTitleMatch(/Page not found/, 'The page is not yet available');
            this.echo('Now waiting 1.5 minutes');
        })
        // trying the same in a minute and a half (to be completely sure)
        .wait(90000)
        .thenOpen(pageUrl, function () {
            test.assertTitleMatch(new RegExp(pageTitle), 'The page is published and available');
        })
        .run(function () {
            this.removeAllFilters('page.confirm');
            test.done();
        });
});
