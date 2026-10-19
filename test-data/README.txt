Test datasets for the upload page

PASS (should upload and work through all steps)
  1_valid_dataset.csv                       600 rows, semicolon separated
  2_valid_with_missing_and_duplicates.csv   passes upload; preprocessing fixes blanks and duplicates
  8_valid_comma_separated.csv               400 rows, comma separated

FAIL (should be rejected on the upload page with a clear message)
  3_invalid_wrong_column_name.csv           "Time_to_Fill" instead of "time_to_fill"
  4_invalid_wrong_unit_fahrenheit.csv       Melt temperature in Fahrenheit
  5_invalid_quality_labels.csv              quality has value 7
  6_invalid_missing_column.csv              "SVo - Shot volume" column is missing
  7_invalid_too_few_rows.csv                only 50 rows (minimum is 100)

These are made-up data. They only test the app, not model accuracy.
Dummy logins: admin@demo.com / Admin@123, engineer@demo.com / Engineer@123, student@demo.com / Student@123
