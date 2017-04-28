;(function ($) {
    function getForwardStrategy(fwdItem, element) {
        var explicitStrategy = fwdItem.strategy || null;

        var checkForCheckboxes = function() {
            var all = true;
            $.each(element, function(ix, e) {
                if ($(e).attr("type") !== "checkbox") {
                    all = false;
                }
            });
            return all;
        };

        if (!!explicitStrategy) {
            // If explicit strategy is set just returning it
            return explicitStrategy;
        } else if (element.length === 1 &&
                element.attr("multiple") !== undefined) {
            // Multiple by HTML semantics. E. g. multiple select
            // Multiple choice field
            return "multiple";
        } else if (element.length > 1 && checkForCheckboxes()) {
            // Multiple checkboxes with the same name.
            // Multiple choice field represented by checkboxes
            return "multiple";
        } else if (element.length === 1 &&
                element.attr("type") === "checkbox") {
            // Single checkbox
            // Boolean field
            return "exists";
        } else {
            // Other cases
            return "single";
        }
    }

    function getForwards(element) {
        var forwardElem,
            forwardList,
            prefix,
            forwardedData,
            divSelector,
            form;
        divSelector = "div.dal-forward-conf#dal-forward-conf-for-" +
                element.attr("id");
        form = element.length > 0 ? $(element[0].form) : $();

        forwardElem =
            form.find(divSelector).find('script');
        if (forwardElem.length === 0) {
            return;
        }
        try {
            forwardList = JSON.parse(forwardElem.text());
        } catch (e) {
            return;
        }

        if (!Array.isArray(forwardList)) {
            return;
        }

        prefix = $(element).getFormPrefix();
        forwardedData = {};

        $.each(forwardList, function(ix, f) {
            if (f.type === "const") {
                forwardedData[f.dst] = f.val;
            } else if (f.type === "field") {
                var srcName,
                    dstName;
                srcName = f.src;
                if (f.hasOwnProperty("dst")) {
                    dstName = f.dst;
                } else {
                    dstName = srcName;
                }

                // First look for this field in the inline
                var fieldSelector = "[name=" + prefix + srcName + "]";
                var field = $(fieldSelector);
                if (!field.length) {
                    // As a fallback, look for it outside the inline
                    fieldSelector = "[name=" + srcName + "]";
                    field = $(fieldSelector);
                }

                var strategy = getForwardStrategy(f, field);
                var serializedField = field.serializeArray();

                var getSerializedFieldElementAt = function(index) {
                    // Return serializedField[index]
                    // or null if something went wrong
                    if (serializedField.length > index) {
                        return serializedField[index];
                    } else {
                        return null;
                    }
                };

                var getValueOf = function(elem) {
                    // Return elem.value
                    // or null if something went wrong
                    if (elem.hasOwnProperty("value") &&
                        elem.value !== undefined
                    ) {
                        return elem.value;
                    } else {
                        return null;
                    }
                };

                var getSerializedFieldValueAt = function (index) {
                    // Return serializedField[index].value
                    // or null if something went wrong
                    var elem = getSerializedFieldElementAt(index);
                    if (elem !== null) {
                        return getValueOf(elem);
                    } else {
                        return null;
                    }
                };

                if (strategy === "multiple") {
                    forwardedData[dstName] = serializedField.map(
                        function (item) { return getValueOf(item); }
                    );
                } else if (strategy === "exists") {
                    forwardedData[dstName] = serializedField.length > 0;
                } else {
                    forwardedData[dstName] = getSerializedFieldValueAt(0);
                }
            }
        });
        return JSON.stringify(forwardedData);
    }

    $(document).on('autocompleteLightInitialize', '[data-autocomplete-light-function=select2]', function() {
        var element = $(this);

        // Templating helper
        function template(item) {
            if (element.attr('data-html') !== undefined) {
                var $result = $('<span>');
                $result.html(item.text);
                return $result;
            } else {
                return item.text;
            }
        }

        var ajax = null;
        if ($(this).attr('data-autocomplete-light-url')) {
            ajax = {
                url: $(this).attr('data-autocomplete-light-url'),
                dataType: 'json',
                delay: 250,

                data: function (params) {
                    var data = {
                        q: params.term, // search term
                        page: params.page,
                        create: element.attr('data-autocomplete-light-create') && !element.attr('data-tags'),
                        forward: getForwards(element)
                    };

                    return data;
                },
                processResults: function (data, page) {
                    if (element.attr('data-tags')) {
                        $.each(data.results, function(index, value) {
                            value.id = value.text;
                        });
                    }

                    return data;
                },
                cache: true
            };
        }

        $(this).select2({
            tokenSeparators: element.attr('data-tags') ? [','] : null,
            debug: true,
            placeholder: '',
            minimumInputLength: 0,
            allowClear: ! $(this).is('required'),
            templateResult: template,
            templateSelection: template,
            ajax: ajax,
        });

        $(this).on('select2:selecting', function (e) {
            var data = e.params.args.data;

            if (data.create_id !== true)
                return;

            e.preventDefault();

            var select = $(this);

            $.ajax({
                url: $(this).attr('data-autocomplete-light-url'),
                type: 'POST',
                dataType: 'json',
                data: {
                    text: data.id,
                    forward: getForwards($(this))
                },
                beforeSend: function(xhr, settings) {
                    xhr.setRequestHeader("X-CSRFToken", document.csrftoken);
                },
                success: function(data, textStatus, jqXHR ) {
                    select.append(
                        $('<option>', {value: data.id, text: data.text, selected: true})
                    );
                    select.trigger('change');
                    select.select2('close');
                }
            });
        });

    });

    // Remove this block when this is merged upstream:
    // https://github.com/select2/select2/pull/4249
    $(document).on('DOMSubtreeModified', '[data-autocomplete-light-function=select2] option', function() {
        $(this).parents('select').next().find(
            '.select2-selection--single .select2-selection__rendered'
        ).text($(this).text());
    });
})(yl.jQuery);
